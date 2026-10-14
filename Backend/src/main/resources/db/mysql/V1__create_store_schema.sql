CREATE TABLE usuario (
    usuario_id INT NOT NULL AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    rut VARCHAR(10) NOT NULL,
    email VARCHAR(200) NOT NULL,
    azure_subject VARCHAR(80),
    password VARCHAR(300) NOT NULL,
    fecha VARCHAR(255) NOT NULL,
    region VARCHAR(100) NOT NULL,
    comuna VARCHAR(100) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    esduoc BIT NOT NULL,
    rol VARCHAR(50) NOT NULL,
    PRIMARY KEY (usuario_id),
    CONSTRAINT uq_usuario_rut UNIQUE (rut),
    CONSTRAINT uq_usuario_email UNIQUE (email),
    CONSTRAINT uq_usuario_azure_subject UNIQUE (azure_subject)
);

CREATE TABLE categorias (
    id BIGINT NOT NULL AUTO_INCREMENT,
    nombre VARCHAR(255),
    PRIMARY KEY (id)
);

CREATE TABLE productos (
    id VARCHAR(255) NOT NULL,
    nombre VARCHAR(255),
    precio DOUBLE PRECISION NOT NULL,
    descuento DOUBLE PRECISION NOT NULL,
    oferta BIT NOT NULL,
    rating DOUBLE PRECISION NOT NULL,
    descripcion VARCHAR(255),
    imagen VARCHAR(255),
    stock INT NOT NULL,
    stock_critico INT NOT NULL,
    categoria_id BIGINT,
    destacado BIT,
    PRIMARY KEY (id),
    CONSTRAINT fk_productos_categoria FOREIGN KEY (categoria_id) REFERENCES categorias(id)
);

CREATE TABLE producto_detalles (
    producto_id VARCHAR(255) NOT NULL,
    detalle_clave VARCHAR(255) NOT NULL,
    detalle_valor VARCHAR(255),
    PRIMARY KEY (producto_id, detalle_clave),
    CONSTRAINT fk_detalles_producto FOREIGN KEY (producto_id) REFERENCES productos(id)
);

CREATE TABLE imagenes (
    id_imagen BIGINT NOT NULL AUTO_INCREMENT,
    nombre VARCHAR(255),
    tipo VARCHAR(255),
    url VARCHAR(255),
    descripcion VARCHAR(255),
    PRIMARY KEY (id_imagen)
);

CREATE TABLE boletas (
    id BIGINT NOT NULL AUTO_INCREMENT,
    usuario_id INT NOT NULL,
    fecha_emision DATETIME(6) NOT NULL,
    total DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_boletas_usuario FOREIGN KEY (usuario_id) REFERENCES usuario(usuario_id)
);

CREATE TABLE detalle_boleta (
    id BIGINT NOT NULL AUTO_INCREMENT,
    boleta_id BIGINT,
    producto_id VARCHAR(255) NOT NULL,
    cantidad INT NOT NULL,
    precio_unitario DOUBLE PRECISION NOT NULL,
    subtotal DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_detalle_boleta FOREIGN KEY (boleta_id) REFERENCES boletas(id),
    CONSTRAINT fk_detalle_producto FOREIGN KEY (producto_id) REFERENCES productos(id)
);

CREATE TABLE resenias (
    id BIGINT NOT NULL AUTO_INCREMENT,
    producto_id VARCHAR(255) NOT NULL,
    usuario_id INT NOT NULL,
    texto LONGTEXT NOT NULL,
    calificacion INT NOT NULL,
    fecha DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_resenias_producto FOREIGN KEY (producto_id) REFERENCES productos(id),
    CONSTRAINT fk_resenias_usuario FOREIGN KEY (usuario_id) REFERENCES usuario(usuario_id)
);
