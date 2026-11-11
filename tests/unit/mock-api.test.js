// Garante que o mock do dashboard segue o mesmo contrato exigido do backend.
import { criarClienteMock, armazenamentoEmMemoria } from '../../publico/js/dashboard/mock-api.js';
import { executarContrato } from '../contrato.js';

executarContrato('mock do dashboard', () => criarClienteMock({ armazenamento: armazenamentoEmMemoria() }));
