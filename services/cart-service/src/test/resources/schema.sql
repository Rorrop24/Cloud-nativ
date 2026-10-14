CREATE TABLE cart_lines (
 owner VARCHAR(100) NOT NULL, product_id VARCHAR(255) NOT NULL, quantity INT NOT NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(owner, product_id)
);
CREATE TABLE event_receipts (
 domain VARCHAR(40) NOT NULL, event_id VARCHAR(100) NOT NULL, reference_id VARCHAR(255),
 processed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(domain,event_id)
);
CREATE TABLE messaging_outbox (
 event_id VARCHAR(100) PRIMARY KEY, producer VARCHAR(100) NOT NULL,
 exchange_name VARCHAR(255) NOT NULL, routing_key VARCHAR(255) NOT NULL, payload MEDIUMTEXT NOT NULL,
 attempts INT NOT NULL DEFAULT 0, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 available_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, delivered_at TIMESTAMP NULL, last_error VARCHAR(1000)
);
CREATE INDEX outbox_pending ON messaging_outbox(producer,delivered_at,available_at);
CREATE TABLE inventory_movements (
 event_id VARCHAR(100) NOT NULL, product_id VARCHAR(255) NOT NULL, boleta_id BIGINT,
 quantity INT NOT NULL, stock_after INT NOT NULL, registered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(event_id,product_id)
);
CREATE TABLE notification_documents (
 event_id VARCHAR(100) PRIMARY KEY, owner VARCHAR(100), boleta_id BIGINT,
 title VARCHAR(255) NOT NULL, content MEDIUMTEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cart_checkout_attempt(owner VARCHAR(100) PRIMARY KEY,request_id VARCHAR(100) NOT NULL,fingerprint VARCHAR(64) NOT NULL);
