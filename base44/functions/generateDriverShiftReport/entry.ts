import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow passing explicit month/year for on-demand generation, otherwise use last month
    const body = await req.json().catch(() => ({}));
    const now = new Date();
    const targetYear = body.year || (now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear());
    const targetMonth = body.month || (now.getMonth() === 0 ? 12 : now.getMonth()); // 1-indexed

    const monthStart = new Date(targetYear, targetMonth - 1, 1).toISOString().split('T')[0];
    const monthEnd = new Date(targetYear, targetMonth, 0).toISOString().split('T')[0];
    const monthLabel = new Date(targetYear, targetMonth - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });

    // Fetch all completed shifts in the month
    const allShifts = await base44.asServiceRole.entities.DriverShift.filter({ status: 'completed' });
    const shifts = allShifts.filter(s => {
      const d = s.clock_in?.split('T')[0];
      return d >= monthStart && d <= monthEnd;
    });

    // Fetch all drivers and fuel logs
    const [drivers, fuelLogs] = await Promise.all([
      base44.asServiceRole.entities.User.list(),
      base44.asServiceRole.entities.FuelLog.list(),
    ]);

    const monthFuelLogs = fuelLogs.filter(fl => {
      const d = fl.fuel_date;
      return d >= monthStart && d <= monthEnd;
    });

    // Group shifts by driver
    const driverMap = {};
    for (const shift of shifts) {
      const dId = shift.driver_id;
      if (!driverMap[dId]) driverMap[dId] = [];
      driverMap[dId].push(shift);
    }

    const reports = [];
    for (const [driverId, driverShifts] of Object.entries(driverMap)) {
      const driver = drivers.find(d => d.id === driverId);
      const driverName = driver?.full_name || driverId;

      let totalMinutes = 0;
      let totalDistance = 0;
      const startOdometers = [];

      for (const s of driverShifts) {
        if (s.clock_in && s.clock_out) {
          const mins = (new Date(s.clock_out) - new Date(s.clock_in)) / 60000;
          totalMinutes += mins;
        }
        if (s.start_odometer) startOdometers.push(s.start_odometer);
        if (s.end_odometer && s.start_odometer) {
          totalDistance += s.end_odometer - s.start_odometer;
        }
      }

      // Fuel logs for this driver in this period
      const driverFuelLogs = monthFuelLogs.filter(fl => {
        // Match by vehicle if shift had a vehicle
        const driverVehicleIds = driverShifts.map(s => s.vehicle_id).filter(Boolean);
        return driverVehicleIds.includes(fl.vehicle_id);
      });

      const totalFuelLitres = driverFuelLogs.reduce((s, fl) => s + (fl.litres || 0), 0);
      const avgFuelEfficiency = driverFuelLogs.length > 0
        ? driverFuelLogs.reduce((s, fl) => s + (fl.efficiency_km_per_litre || 0), 0) / driverFuelLogs.filter(fl => fl.efficiency_km_per_litre).length
        : null;

      reports.push({
        driver_id: driverId,
        driver_name: driverName,
        month: monthLabel,
        total_shifts: driverShifts.length,
        total_hours: Math.round(totalMinutes / 60 * 10) / 10,
        total_distance_km: Math.round(totalDistance),
        starting_odometers: startOdometers,
        min_start_odometer: startOdometers.length ? Math.min(...startOdometers) : null,
        total_fuel_litres: Math.round(totalFuelLitres * 10) / 10,
        avg_fuel_efficiency_km_per_litre: avgFuelEfficiency ? Math.round(avgFuelEfficiency * 10) / 10 : null,
        fuel_entries: driverFuelLogs.length,
      });
    }

    return Response.json({ month: monthLabel, reports, generated_at: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});