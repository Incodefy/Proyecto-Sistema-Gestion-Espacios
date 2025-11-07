exports.simulate = async (event) => {
  const delay = Math.floor(Math.random() * 5000); // entre 0 y 5 segundos
  console.log(`⏳ Simulando retraso de ${delay}ms`);

  await new Promise((resolve) => setTimeout(resolve, delay));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: "ok",
      message: "Respuesta con latencia simulada",
      simulatedDelay: `${delay}ms`,
      timestamp: new Date().toISOString(),
    }),
  };
};
