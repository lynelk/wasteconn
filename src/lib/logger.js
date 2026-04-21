const safeSerialize = (value) => {
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
};

const makeLogger = (level) => (event, meta = {}) => {
  const payload = {
    level,
    event,
    timestamp: new Date().toISOString(),
    meta
  };

  const output = `[${payload.level}] ${payload.event} ${safeSerialize(payload.meta)}`;
  if (level === 'error') {
    console.error(output);
    return;
  }

  if (level === 'warn') {
    console.warn(output);
    return;
  }

  console.info(output);
};

export const logger = {
  info: makeLogger('info'),
  warn: makeLogger('warn'),
  error: makeLogger('error')
};
