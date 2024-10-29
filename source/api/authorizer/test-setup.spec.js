import sinon from 'sinon';
import { use } from 'chai';
import sinonChai from 'sinon-chai';

before(function() {
    use(sinonChai);
});

beforeEach(function() {
    this.sandbox = sinon.createSandbox();
});

afterEach(function() {
    this.sandbox.restore();
});