import { run } from '../src/db.js';

function id() {
    return Math.random().toString(36).substring(2, 10);
}

const pwd = 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3'; // 123

run('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)', [id(), 'Motorista Livre 01', 'livre1@teste.com', pwd, 'driver', 1]);
run('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)', [id(), 'Motorista Livre 02', 'livre2@teste.com', pwd, 'driver', 1]);

console.log('2 motoristas livres criados.');
