module.exports = VMWriter;

function VMWriter(className) {
    this.className = className;
    this.labelCount = 0;
    this.code = [];
}

VMWriter.prototype = {
    constructor: VMWriter,
    writePush: function(segment, idx) {
        this.code.push('push '+ this.getSegment(segment) + ' ' + idx);
    },
    writePop: function(segment, idx) {
        this.code.push('pop ' + this.getSegment(segment) + ' ' + idx);
    },
    writeArithmetic: function(op) {
        var lookup = {
            '*': 'call Math.multiply 2',
            '/': 'call Math.divide 2',
            '+': 'add',
            '-': 'sub',
            '<': 'lt',
            '>': 'gt',
            '=': 'eq',
            '&': 'and',
            '|': 'or'
        };
        this.code.push(lookup[op]);
    },
    writeUnaryOp: function(op) {
        var lookup = {
            '-': 'neg',
            '~': 'not'
        };
        this.code.push(lookup[op]);
    },
    writeLabel: function(label) {
        this.code.push('label ' + label);
    },
    writeGoto: function(label) {
        this.code.push('goto ' + label);
    },
    writeIf: function(label) {
        this.code.push('if-goto ' + label);
    },
    writeCall: function(name, nArgs) {
        if (!(/.+\..+/.test(name))) {
            name = this.className + '.' + name;
        }
        this.code.push('call ' +name + ' ' + nArgs);
    },
    writeFunction: function(name, nLocals, idx) {
        if (!(/.+\..+/.test(name))) {
            name = this.className + '.' + name;
        }
        this.code.splice(idx, 0, 'function ' + name + ' ' + nLocals);
    }, 
    writeReturn: function() {
        this.code.push('return');
    },
    getSegment: function(segment) {
        var lookup = {
            'const': 'constant',
            'arg': 'argument',
            'var': 'local',
            'static': 'static',
            'field': 'this',
            'that': 'that',
            'pointer': 'pointer',
            'temp': 'temp'
        }
        return lookup[segment];
    },
    nameLabel: function() {
        let label = this.className + this.labelCount;
        this.labelCount++;
        return label;
    },
    getIdx: function() {
        return this.code.length;
    }
}

var test = new VMWriter();
test.writeCall('func', '2', 'className');
