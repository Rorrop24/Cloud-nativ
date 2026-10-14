-- Productos ficticios para probar Punto Gamer en MySQL/RDS.
-- Solo agrega registros faltantes; no cambia productos ni categorias existentes.
USE punto_gamer;
SET NAMES utf8mb4;
START TRANSACTION;

INSERT INTO categorias (nombre)
SELECT demo.nombre
FROM (
    SELECT 'Teclados' AS nombre
    UNION ALL SELECT 'Mouse'
    UNION ALL SELECT 'Consolas'
) AS demo
LEFT JOIN categorias AS existente ON existente.nombre = demo.nombre
WHERE existente.id IS NULL
ORDER BY demo.nombre;

INSERT INTO productos
    (id, nombre, precio, descuento, oferta, rating, descripcion, imagen,
     stock, stock_critico, categoria_id, destacado)
SELECT demo.id, demo.nombre, demo.precio, 0, 0, 0,
       'Producto ficticio para probar el catalogo y el carrito.', '',
       20, 5, categoria.id, 1
FROM (
    SELECT 'DEMO-TEC-01' AS id, 'Teclado gamer de prueba' AS nombre,
           29990 AS precio, 'Teclados' AS categoria
    UNION ALL SELECT 'DEMO-MOU-01', 'Mouse gamer de prueba', 14990, 'Mouse'
    UNION ALL SELECT 'DEMO-CON-01', 'Consola de prueba', 199990, 'Consolas'
) AS demo
JOIN (
    SELECT nombre, MIN(id) AS id
    FROM categorias
    GROUP BY nombre
) AS categoria ON categoria.nombre = demo.categoria
LEFT JOIN productos AS existente ON existente.id = demo.id
WHERE existente.id IS NULL
ORDER BY demo.id;

COMMIT;

SELECT p.id, p.nombre, p.precio, p.stock, c.nombre AS categoria
FROM productos AS p
JOIN categorias AS c ON c.id = p.categoria_id
WHERE p.id IN ('DEMO-TEC-01', 'DEMO-MOU-01', 'DEMO-CON-01')
ORDER BY p.id;
