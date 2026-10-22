CREATE ROLE netmind_app LOGIN PASSWORD 'netmind_app_local';
GRANT CONNECT ON DATABASE netmind TO netmind_app;
