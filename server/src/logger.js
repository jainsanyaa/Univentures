// ========================================
// logger.js — Request-logging middleware
//
// A small custom Express middleware that logs every incoming request:
// HTTP method, URL, response status code and how long it took to handle.
// This demonstrates how middleware intercepts the request/response cycle —
// it runs on the way in, hands control onward with next(), and uses the
// response's 'finish' event to report the outcome once the route is done.
// ========================================

// ANSI colours so status codes are easy to scan in the terminal.
const colour = {
  reset: '\x1b[0m',
  grey: '\x1b[90m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

// Pick a colour for a status code: 2xx green, 3xx cyan, 4xx yellow, 5xx red.
function statusColour(status) {
  if (status >= 500) return colour.red;
  if (status >= 400) return colour.yellow;
  if (status >= 300) return colour.cyan;
  return colour.green;
}

export function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();

  // The 'finish' event fires once the response has been fully sent.
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const time = new Date().toISOString();
    const status = res.statusCode;
    const line =
      `${colour.grey}[${time}]${colour.reset} ` +
      `${colour.cyan}${req.method}${colour.reset} ${req.originalUrl} ` +
      `${statusColour(status)}${status}${colour.reset} ` +
      `${colour.grey}${durationMs.toFixed(1)}ms${colour.reset}`;
    console.log(line);
  });

  next();
}

export default requestLogger;
