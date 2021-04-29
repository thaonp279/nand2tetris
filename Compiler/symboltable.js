module.exports = SymbolTable;

function SymbolTable() {
    this.class = {};
    this.subroutine = {};
}

SymbolTable.prototype = {
    constructor: SymbolTable,
    startSubroutine: function() {
        this.subroutine = {};
    },
    define: function(name, type, kind) {
        let idx = this.varCount(kind);
        if (kind === 'static' || kind === 'field') {
            this.class[name] = {type, kind, idx};
        } else if (kind === 'var' || kind == 'arg'){
            this.subroutine[name] = {type, kind, idx};
        }
    },
    varCount: function(kind) {
        let count = 0;
            for (s in this.class) {
                if (this.class[s].kind === kind) {
                    count++;
                }
            }
            for (s in this.subroutine) {
                if (this.subroutine[s].kind === kind) {
                    count++;
                }
            }
        return count;
    },
    getIdentifier: function(name) {
        if (name in this.subroutine) {
            return this.subroutine[name]
        } else if (name in this.class) {
            return this.class[name]
        }
    }
}
