DELETE FROM usuarios
WHERE id IN ('root-user', 'admin-user', 'env-root-user', 'env-admin-user')
   OR lower(email) IN ('root@root.com', 'admin@admin.com', 'root@example.com', 'admin@example.com');
