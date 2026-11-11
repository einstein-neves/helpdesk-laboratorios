// Garante que o mock da interface segue o mesmo contrato exigido do backend.
import { criarClienteMock } from '../../src/js/mock-api.js';
import { executarContrato } from '../contrato.js';

const memoria = () => {
  let dados = null;
  return { ler: () => dados, salvar: (d) => { dados = d; } };
};

executarContrato('mock da interface', () => criarClienteMock({ armazenamento: memoria() }));
