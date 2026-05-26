const { createEpi, listEpis, readJsonBody, sendError, sendJson } = require("./_episService");

module.exports = async function handler(request, response) {
  try {
    if (request.method === "GET") {
      const data = await listEpis();
      sendJson(response, 200, data);
      return;
    }

    if (request.method === "POST") {
      const payload = await readJsonBody(request);
      const data = await createEpi(payload);
      sendJson(response, 201, data);
      return;
    }

    sendJson(response, 405, { error: "Metodo nao permitido." });
  } catch (error) {
    sendError(response, error);
  }
};
