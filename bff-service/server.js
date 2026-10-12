import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3001;
const EC2_URL = process.env.EC2_URL || "http://3.210.29.100:8082";

app.use(cors());
app.use(express.json());

// Endpoint BFF equivalente a tu handler de Lambda
app.get("/api/bff/catalogo-completo", async (req, res) => {
  const authHeader = req.headers.authorization;

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

    return res.status(200).json({
      resumen: {
        totalProductos: productos.length,
        totalCategorias: categorias.length
      },
      catalogo: productos,
      categoriasDisponibles: categorias
    });

  } catch (error) {
    console.error("Error en BFF:", error);
    return res.status(500).json({ error: "Error en agregación de datos BFF" });
  }
});

app.listen(PORT, () => {
  console.log(`[BFF] Servidor corriendo físicamente en puerto ${PORT}`);
});