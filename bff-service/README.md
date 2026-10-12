# Microservicio BFF (Backend For Frontend)

Este componente implementa el patrón BFF para la agregación del catálogo y categorías.
Está diseñado como una función Serverless desacoplada para ejecutarse en AWS Lambda (o contenedor ligero), reduciendo la latencia hacia el frontend y evitando sobrecargar de llamadas el backend principal en EC2.