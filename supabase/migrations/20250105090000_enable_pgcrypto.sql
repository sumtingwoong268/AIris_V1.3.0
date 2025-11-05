-- Ensure pgcrypto is available for functions using gen_random_bytes
create extension if not exists pgcrypto;
