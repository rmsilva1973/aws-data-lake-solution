const sinon = require('sinon');
const chai = require('chai');
const sinonChai = require('sinon-chai');

chai.use(sinonChai);

let sandbox;

beforeEach(function() {
    sandbox = sinon.createSandbox();
});

afterEach(function() {
    sandbox.restore();
});