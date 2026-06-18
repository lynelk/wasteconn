import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (user.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const { payment_id } = await req.json();
        
        if (!payment_id) {
            return Response.json({ error: 'payment_id is required' }, { status: 400 });
        }

        // Fetch payment and related data
        const payment = await base44.entities.Payment.get(payment_id);
        if (!payment) {
            return Response.json({ error: 'Payment not found' }, { status: 404 });
        }

        // Check if EFRIS invoice already exists
        const existingEFRIS = await base44.entities.EFRISInvoiceLog.filter({ payment_id });
        if (existingEFRIS && existingEFRIS.length > 0) {
            return Response.json({ 
                message: 'EFRIS invoice already exists for this payment',
                invoice: existingEFRIS[0]
            });
        }

        // Fetch customer data
        const customer = await base44.entities.Customer.get(payment.customer_id);
        if (!customer) {
            return Response.json({ error: 'Customer not found' }, { status: 404 });
        }

        // Fetch subscription or invoice details
        let invoiceItems = [];
        let subscription = null;
        
        if (payment.subscription_id) {
            subscription = await base44.entities.Subscription.get(payment.subscription_id);
            if (subscription) {
                const plan = await base44.entities.ServicePlan.get(subscription.plan_id);
                if (plan) {
                    invoiceItems = [{
                        description: `Subscription: ${plan.plan_name}`,
                        quantity: 1,
                        unit_price_ugx: plan.price_ugx,
                        total_ugx: plan.price_ugx
                    }];
                }
            }
        }

        if (!invoiceItems.length && payment.items) {
            invoiceItems = payment.items;
        }

        // Calculate tax (18% VAT for Uganda)
        const grossAmount = payment.amount_ugx;
        const taxRate = 0.18;
        const netAmount = grossAmount / (1 + taxRate);
        const taxAmount = grossAmount - netAmount;

        // EFRIS API Configuration
        const EFRIS_API_URL = Deno.env.get('EFRIS_API_URL') || 'https://efris.ura.go.ug';
        const EFRIS_USERNAME = Deno.env.get('EFRIS_USERNAME');
        const EFRIS_PASSWORD = Deno.env.get('EFRIS_PASSWORD');

        if (!EFRIS_USERNAME || !EFRIS_PASSWORD) {
            throw new Error('EFRIS credentials not configured. Please set EFRIS_USERNAME and EFRIS_PASSWORD secrets.');
        }

        // Step 1: Login to EFRIS (T103)
        const loginPayload = {
            data: {
                username: EFRIS_USERNAME,
                password: EFRIS_PASSWORD
            },
            globalInfo: {
                interfaceCode: 'T103',
                interfaceName: 'Login',
                requestTime: new Date().toISOString().replace(/[-:]/g, '').slice(0, 14)
            }
        };

        const loginResponse = await fetch(`${EFRIS_API_URL}/api/v1/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(loginPayload)
        });

        const loginResult = await loginResponse.json();
        
        if (!loginResult.returnStateInfo || loginResult.returnStateInfo.responseCode !== '0000') {
            throw new Error(`EFRIS Login failed: ${loginResult.returnStateInfo?.responseMsg || 'Unknown error'}`);
        }

        const sessionToken = loginResult.data?.token;

        // Step 2: Upload Invoice (T109)
        const invoiceNumber = `INV-${payment_id.slice(-8).toUpperCase()}`;
        const requestTime = new Date().toISOString().replace(/[-:]/g, '').slice(0, 14);

        const invoicePayload = {
            data: {
                invoiceCode: invoiceNumber,
                invoiceDate: new Date().toISOString().split('T')[0],
                buyerTin: customer.tin || 'N/A',
                buyerName: customer.full_name,
                buyerAddress: customer.address || 'N/A',
                invoiceType: '01', // Standard invoice
                currency: 'UGX',
                items: invoiceItems.map((item, idx) => ({
                    itemCode: `ITEM-${idx + 1}`,
                    itemName: item.description || 'Service',
                    itemPrice: item.unit_price_ugx || 0,
                    itemQuantity: item.quantity || 1,
                    itemTotal: item.total_ugx || 0,
                    taxRate: '18',
                    taxAmount: (item.total_ugx || 0) * 0.1525 // Effective tax portion
                })),
                totalAmount: grossAmount,
                taxAmount: taxAmount,
                netAmount: netAmount
            },
            globalInfo: {
                interfaceCode: 'T109',
                interfaceName: 'Invoice Upload',
                requestTime: requestTime,
                token: sessionToken
            }
        };

        const invoiceResponse = await fetch(`${EFRIS_API_URL}/api/v1/invoice/upload`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify(invoicePayload)
        });

        const invoiceResult = await invoiceResponse.json();

        // Create EFRIS log record
        const efrisLogData = {
            tenant_id: payment.tenant_id,
            payment_id: payment_id,
            customer_id: payment.customer_id,
            customer_name: customer.full_name,
            customer_tin: customer.tin || 'N/A',
            gross_amount_ugx: grossAmount,
            tax_amount_ugx: taxAmount,
            net_amount_ugx: netAmount,
            submission_timestamp: new Date().toISOString()
        };

        if (invoiceResult.returnStateInfo && invoiceResult.returnStateInfo.responseCode === '0000') {
            // Success
            efrisLogData.status = 'success';
            efrisLogData.invoice_number = invoiceResult.data?.invoiceNumber || invoiceNumber;
            efrisLogData.ura_response_code = invoiceResult.returnStateInfo.responseCode;

            const efrisLog = await base44.entities.EFRISInvoiceLog.create(efrisLogData);

            // Create notification for success
            await base44.entities.Notification.create({
                tenant_id: payment.tenant_id,
                user_id: user.id,
                title: 'EFRIS Invoice Generated Successfully',
                message: `EFRIS invoice ${efrisLog.invoice_number} has been successfully generated for payment of UGX ${grossAmount.toLocaleString()}.`,
                type: 'success',
                is_read: false
            });

            return Response.json({
                success: true,
                message: 'EFRIS invoice generated successfully',
                invoice: efrisLog,
                ura_response: invoiceResult
            });
        } else {
            // Failed
            efrisLogData.status = 'failed';
            efrisLogData.invoice_number = invoiceNumber;
            efrisLogData.ura_response_code = invoiceResult.returnStateInfo?.responseCode || 'ERROR';
            
            const efrisLog = await base44.entities.EFRISInvoiceLog.create(efrisLogData);

            // Create notification for failure
            await base44.entities.Notification.create({
                tenant_id: payment.tenant_id,
                user_id: user.id,
                title: 'EFRIS Invoice Generation Failed',
                message: `Failed to generate EFRIS invoice for payment of UGX ${grossAmount.toLocaleString()}. Reason: ${invoiceResult.returnStateInfo?.responseMsg || 'Unknown error'}`,
                type: 'error',
                is_read: false
            });

            return Response.json({
                success: false,
                message: 'EFRIS invoice generation failed',
                error: invoiceResult.returnStateInfo?.responseMsg || 'Unknown error',
                invoice: efrisLog,
                ura_response: invoiceResult
            }, { status: 400 });
        }

    } catch (error) {
        // Create error log
        try {
            const base44 = createClientFromRequest(req);
            const { payment_id } = await req.json();
            const payment = await base44.entities.Payment.get(payment_id);
            
            if (payment) {
                await base44.entities.EFRISInvoiceLog.create({
                    tenant_id: payment.tenant_id,
                    payment_id: payment_id,
                    customer_id: payment.customer_id,
                    status: 'failed',
                    gross_amount_ugx: payment.amount_ugx,
                    tax_amount_ugx: payment.amount_ugx * 0.1525,
                    net_amount_ugx: payment.amount_ugx * 0.8475,
                    submission_timestamp: new Date().toISOString(),
                    ura_response_code: 'SYSTEM_ERROR'
                });

                const user = await base44.auth.me();
                await base44.entities.Notification.create({
                    tenant_id: payment.tenant_id,
                    user_id: user?.id,
                    title: 'EFRIS System Error',
                    message: `System error while generating EFRIS invoice: ${error.message}`,
                    type: 'error',
                    is_read: false
                });
            }
        } catch (logError) {
            console.error('Failed to create error log:', logError);
        }

        return Response.json({ 
            error: error.message,
            success: false
        }, { status: 500 });
    }
});