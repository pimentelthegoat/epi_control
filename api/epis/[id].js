const { deleteEpi, readJsonBody, sendError, sendJson, updateEpi } = require("../_episService");

module.exports = async function handler(request, response) {
  try {
    const { id } = request.query || {};
    const epiId = Array.isArray(id) ? id[0] : id;

    if (!epiId) {
      sendJson(response, 400, { error: "ID do EPI nao informado." });
      return;
    }

    if (request.method === "PUT") {
      const payload = await readJsonBody(request);
      const data = await updateEpi(epiId, payload);
      sendJson(response, 200, data);
      return;
    }

    if (request.method === "DELETE") {
      const data = await deleteEpi(epiId);
      sendJson(response, 200, data);
      return;
    }

    sendJson(response, 405, { error: "Metodo nao permitido." });
  } catch (error) {
    sendError(response, error);
  }
};
