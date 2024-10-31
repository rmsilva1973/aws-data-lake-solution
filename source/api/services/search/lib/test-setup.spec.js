import { createSandbox } from 'sinon';
import { use } from 'chai';
import sinonChai from 'sinon-chai';

before(function() {
    use(sinonChai);
});

beforeEach(function() {
    // Usar sinon.createSandbox() em vez de sinon.sandbox.create()
    this.sandbox = createSandbox();
});

afterEach(function() {
    // Restaurar o sandbox criado
    this.sandbox.restore();
});