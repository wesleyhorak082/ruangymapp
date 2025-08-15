-- Insert the admin user (Ruan Kemp) into admin_profiles
INSERT INTO admin_profiles (id, email, username, full_name, role)
VALUES (
    (SELECT id FROM auth.users WHERE email = 'ruansgym@gmail.com' LIMIT 1),
    'ruansgym@gmail.com',
    'Ruan',
    'Ruan Kemp',
    'admin'
);
