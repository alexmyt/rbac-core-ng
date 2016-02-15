'use strict';

const Async = require('async');
const Boom = require('boom');

const DENY = 0;
const PERMIT = 1;
const UNDETERMINED = 3;

const internals = {};

/**
 * Evaluate a single Policy of PolicySet
 *
 **/
internals.evaluatePolicy = (item, dataRetriever, callback) => {

    if (!item) {
        return callback(Boom.badImplementation('RBAC configuration error: null item'));
    }

    if (!item.apply) {
        item.apply = 'permit-overrides';
    }

    if (!(item.apply instanceof Function)) {
        if (!internals.combineAlg[item.apply]) {
            return callback(Boom.badImplementation('RBAC error: combinatory algorithm does not exist: ' + item.apply));
        }

        item.apply = internals.combineAlg[item.apply];
    }

    internals.evaluateTarget(item.target, dataRetriever, (err, applies) => {

        if (err) {
            return callback(err);
        }

        if (!applies) {
            return callback(null, UNDETERMINED);
        }

        // Policy set
        if (item.policies) {

            return item.apply(item.policies, dataRetriever, internals.evaluatePolicy, callback);
        }

        // Policy
        if (item.rules) {

            return item.apply(item.rules, dataRetriever, internals.evaluateRule, callback);
        }

        // Rule
        internals.evaluateRule(item, dataRetriever, callback);
    });
};


/**
 * Evaluate a single rule.
 *
 * {
 *    'target': ['any-of', item1, ..., itemN],
 *    'effect': PERMIT, DENY
 * }
 **/
internals.evaluateRule = (rule, dataRetriever, callback) => {

    if (!rule) {
        return callback(Boom.badImplementation('RBAC rule is missing'));
    }

    internals.evaluateTarget(rule.target, dataRetriever, (err, applies) => {

        if (err) {
            return callback(err);
        }

        if (!applies) {
            return callback(null, UNDETERMINED);
        }

        switch (rule.effect) {
            case 'permit':
            case PERMIT:
                return callback(null, PERMIT);
            case 'deny':
            case DENY:
                return callback(null, DENY);
            default:
                return callback(Boom.badImplementation('RBAC rule error: invalid effect ' + rule.effect));
        }
    });
};

/**
 * Evaluate a target
 * ['any-of', {type: 'username', value:'francisco'}, {type: 'group', value:'admin'}]
 * ['all-of', {type: 'username', value:'francisco'}, {type: 'group', value:'admin'}]
 **/
internals.evaluateTarget = (target, dataRetriever, callback) => {

    if (!target) {
        // Applies by default, when no target is defined
        return callback(null, true);
    }

    if (!(target instanceof Array) || target.length < 2) {
        return callback(Boom.badImplementation('RBAC target error: invalid format. Should be an array with match type and items ["all-of", item1, item2, ..., itemN]'));
    }

    for (let i = 1; i < target.length; ++i) {
        const value = dataRetriever.get(target[i].type);

        const result = internals._targetApplies(target[i].value, value);

        if (result && target[0] === 'any-of') {
            return callback(null, true);
        }

        if (!result && target[0] === 'all-of') {
            return callback(null, false);
        }
    }

    return callback(null, target[0] === 'all-of');
};

internals._targetApplies = (target, value) => {

    if (target === value) {
        return true;
    }

    if (value instanceof Array) {
        if (value.indexOf(target) !== -1) {
            return true;
        }
    }

    return false;
};

/**
 * Combinator algorithms:
 *
 *   - permit-overrides - If at least one permit is evaluated, then permit
 *   - deny-overrides - If at least one deny is evaluated, then deny
 *   - only-one-applicable -
 *   - first-applicable - Only evaluate the first applicable rule
 **/
internals.combineAlg = {};

internals.combineAlg['permit-overrides'] = (items, information, fn, callback) => {

    if (!items || items.length === 0) {
        return callback(null, UNDETERMINED);
    }

    const tasks = [];

    for (let i = 0; i < items.length; ++i) {
        tasks.push(fn.bind(null, items[i], information));
    }

    Async.parallel(tasks, (err, results) => {

        if (err) {
            return callback(err);
        }

        for (let i = 0; i < results.length; ++i) {
            if (results[i] === PERMIT) {
                return callback(null, PERMIT);
            }
        }

        callback(null, DENY);
    });
};

internals.combineAlg['deny-overrides'] = (items, information, fn, callback) => {

    if (!items || items.length === 0) {
        return callback(null, UNDETERMINED);
    }

    const tasks = [];

    for (let i = 0; i < items.length; ++i) {
        tasks.push(fn.bind(null, items[i], information));
    }

    Async.parallel(tasks, (err, results) => {

        if (err) {
            return callback(err);
        }

        for (let i = 0; i < results.length; ++i) {
            if (results[i] === DENY) {
                return callback(null, DENY);
            }
        }

        callback(null, PERMIT);
    });
};

exports = module.exports = {
    evaluatePolicy: internals.evaluatePolicy,
    evaluateRule: internals.evaluateRule,
    evaluateTarget: internals.evaluateTarget,
    DENY: DENY,
    PERMIT: PERMIT,
    UNDETERMINED: UNDETERMINED,
    DataRetrievalRouter: require('./DataRetrievalRouter')
};
