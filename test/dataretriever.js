'use strict';

const Code = require('@hapi/code');
const Lab = require('@hapi/lab');
const DataRetrievalRouter = require('../').DataRetrievalRouter;

const lab = exports.lab = Lab.script();
const experiment = lab.experiment;
const test = lab.test;

const expect = Code.expect;

/**
 * Rule based access control policy tests, based on username
 **/
experiment('RBAC internal modular information retrieval', () => {

    const dataRetriever = new DataRetrievalRouter();

    test('should register a valid retriever', async () => {

        const retriever = (source, key, context) => {

            return 'key-' + key;
        };

        dataRetriever.register('test', retriever);

        const result = await dataRetriever.get('test:x');
        expect(result).to.equal('key-x');
    });

    test('should override a valid retriever (single handler)', async () => {

        const retriever1 = (source, key, context) => {

            return key + '-1';
        };

        const retriever2 = (source, key, context) => {

            return key + '-2';
        };

        dataRetriever.register('test-override', retriever1);
        dataRetriever.register('test-override', retriever2, { override: true });

        const result = await dataRetriever.get('test-override:test');
        expect(result).to.equal('test-2');
    });

    test('should not override a valid retriever (single handler)', () => {

        const retriever1 = (source, key, context) => {

            return key + '-1';
        };

        const retriever2 = (source, key, context) => {

            return key + '-2';
        };

        dataRetriever.register('test-override-error', retriever1);

        expect(dataRetriever.register.bind(dataRetriever, 'test-override-error', retriever2)).to.throw();

    });

    test('should override a valid retriever (multiple handlers)', async () => {

        const retriever1 = (source, key, context) => {

            return key + '-1';
        };

        const retriever2 = (source, key, context) => {

            return key + '-2';
        };

        dataRetriever.register(['test-override-multiple-1', 'test-override-multiple-2', 'test-override-multiple-3'], retriever1);
        dataRetriever.register(['test-override-multiple-2', 'test-override-multiple-4'], retriever2, { override: true }); // test-override-multiple-2 collides

        const results = await Promise.all([
            dataRetriever.get('test-override-multiple-1:test'),
            dataRetriever.get('test-override-multiple-2:test'),
            dataRetriever.get('test-override-multiple-3:test'),
            dataRetriever.get('test-override-multiple-4:test')
        ]);
        expect(results[0]).to.equal('test-1');
        expect(results[1]).to.equal('test-2');
        expect(results[2]).to.equal('test-1');
        expect(results[3]).to.equal('test-2');
    });

    test('should not override a valid retriever (multiple handlers)', () => {

        const retriever1 = (source, key, context) => {

            return key + '-1';
        };

        const retriever2 = (source, key, context) => {

            return key + '-2';
        };

        dataRetriever.register(['test-override-error-multiple-1', 'test-override-error-multiple-2', 'test-override-error-multiple-3'], retriever1);
        expect(dataRetriever.register.bind(dataRetriever, ['test-override-error-multiple-2', 'test-override-error-multiple-4'], retriever2)).to.throw(Error, 'There is a data retriever already registered for the source: test-override-error-multiple-2');

    });

    test('should register a valid asynchronous retriever', async () => {

        const retriever = (source, key, context, callback) => {

            callback(null, 'key-' + key);
        };

        dataRetriever.register('async-test', retriever);

        const result = await dataRetriever.get('async-test:x');
        expect(result).to.equal('key-x');
    });

    test('should use parent asynchronous retriever', async () => {

        const retriever = (source, key, context, callback) => {

            callback(null, 'key-' + key);
        };

        dataRetriever.register('async-parent-test-1', retriever);

        const childDataRetriever = dataRetriever.createChild();

        const result = await childDataRetriever.get('async-parent-test-1:x');
        expect(result).to.equal('key-x');
    });

    test('should use parent synchronous retriever', async () => {

        const retriever = (source, key, context) => {

            return 'key-' + key;
        };

        dataRetriever.register('sync-parent-test-1', retriever);

        const childDataRetriever = dataRetriever.createChild();

        const result = await childDataRetriever.get('sync-parent-test-1:x');
        expect(result).to.equal('key-x');
    });

    test('should return null if inexistent prefix on child and parent', async () => {

        const childDataRetriever = dataRetriever.createChild();

        const result = await childDataRetriever.get('this-does-not-exist-1:x');
        expect(result).to.not.exist();
    });

    test('should not allow using get with context', async () => {

        try {
            await dataRetriever.get('get-with-context', {});
            fail('Should have rejected');
        } catch (err) {
            expect(err).to.exist();
            expect(err.message).to.exist().and.not.equal('Should have rejected');
        }
    });

    test('should not allow using get without context', async () => {

        try {
            await dataRetriever.get('get-with-context');
            fail('Should have rejected');
        } catch (err) {
            expect(err).to.exist();
            expect(err.message).to.exist().and.not.equal('Should have rejected');
        }
    });

    test('should return err in callback when an error is thrown (sync)', async () => {

        const retriever = (source, key, context) => {

            throw new Error('test');
        };

        dataRetriever.register('sync-test-err-1', retriever);

        try {
            await dataRetriever.get('sync-test-err-1:x');
            fail('Should have rejected');
        } catch (err) {
            expect(err).to.exist();
            expect(err.message).to.exist().and.not.equal('Should have rejected');
        }
    });

    test('should return err in callback when an error is thrown (async)', async () => {

        const retriever = (source, key, context, callback) => {

            throw new Error('test');
        };

        dataRetriever.register('async-test-err-1', retriever);

        try {
            await dataRetriever.get('async-test-err-1:x');
            fail('Should have rejected');
        } catch (err) {
            expect(err).to.exist();
            expect(err.message).to.exist().and.not.equal('Should have rejected');
        }
    });
});
