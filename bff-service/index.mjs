export const handler = async (event) => {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  const EC2_URL = "http://3.210.29.100:8082";

  try {
    const [resProd, resCat] = await Promise.all([
      fetch(`${EC2_URL}/v2/productos/todos`, {
        headers: {
          "Content-Type": "application/json",
          ...(authHeader ? { Authorization: authHeader } : {})
        }
      }),
      fetch(`${EC2_URL}/v2/categorias/todas`)
    ]);

    const productos = resProd.ok ? await resProd.json() : [];
    const categorias = resCat.ok ? await resCat.json() : [];

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        resumen: {
          totalProductos: productos.length,
          totalCategorias: categorias.length
        },
        catalogo: productos,
        categoriasDisponibles: categorias
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Error en agregación de datos BFF" })
    };
  }
};