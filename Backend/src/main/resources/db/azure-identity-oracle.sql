-- Run once, after taking a backup, on the existing Oracle schema.
ALTER TABLE USUARIO ADD (azure_subject VARCHAR2(80));
ALTER TABLE USUARIO ADD CONSTRAINT uk_usuario_azure_subject UNIQUE (azure_subject);
-- Link a legacy user only after verifying their Azure tenant and object ID:
-- UPDATE USUARIO SET azure_subject = '<tenant-id>:<object-id>' WHERE usuario_id = <verified-id>;
