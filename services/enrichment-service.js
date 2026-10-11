const { fetchWithRetry } = require("./external-api");

async function getEmployeeEnrichment(employeeId) {
  const url = `https://jsonplaceholder.typicode.com/todos/${employeeId}`;

  try {
    const data = await fetchWithRetry(url, 3000, 2);
    return {
      source: "external",
      available: true,
      note: data.title,
    };
  } catch (error) {
    console.error(
      `[enrichment-service] external API unavailable after retries: ${error.message}`,
    );
    return {
      source: "fallback",
      available: false,
      note: "ไม่สามารถดึงข้อมูลเสริมจากบริการภายนอกได้ในขณะนี้ กรุณาลองใหม่ภายหลัง",
    };
  }
}

module.exports = { getEmployeeEnrichment };
