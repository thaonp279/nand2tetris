const SymbolTable = require('./symboltable.js');
const VMWriter = require('./vmwriter.js');


var keywordArr = ['class','constructor','function','method','field','static','var','int','char','boolean','void','true','false','null','this','let','do','if','else','while','return'];
var keyword = ' '+ keywordArr.join(' | ') + ' ';
var symbol = '[{}()\\[\\]\\.,;\\+\\-\\*\\/\\&\\|\\<\\>\\=\\~]';
var integerConstant = '\\d+';
var stringConstant = '".*?"';
var identifier = '[a-zA-Z_]\\w*';
var regex = new RegExp(keyword+'|'+symbol+'|'+integerConstant+'|'+stringConstant+'|'+identifier, 'g');
var varType = ['int','char','boolean'];

//regex
var integerRegx = new RegExp('^'+integerConstant+'$');
var stringRegx = new RegExp('^'+stringConstant+'$');
var identifierRegx = new RegExp('^'+identifier+'$');

function Tokenizer(data) {
    this.data = data;
}

Tokenizer.prototype = {
    constructor: Tokenizer,
    cleanUp: function() {
        //remove /** */ comments
       return this.data.replace(/\/\*\*(.|\n|\r)*?\*\//g, '')
       //remove // comments
       .replace(/\/\/.*[\n\r]/g, '')
    },
    tokenize: function(str) {
        let tokens = [];
        let arr;
        
        while ((arr = regex.exec(str))!== null) {
            let token = arr[0].trim();
            tokens.push({type: this.getType(token), val: this.getVal(token)});
        }
        return tokens;
    },
    getType: function(token) {
        if (match(token, ...keywordArr)) {
            return 'keyword';
        } else if (match(token,'{','}','(',')','[',']','.',',',';','+','-','*','/','&','|','<','>','=','~',')')) {
            return 'symbol';
        } else if (integerRegx.test(token)) {
            return 'integerConstant';
        } else if (stringRegx.test(token)) {
            return 'stringConstant';
        } else if (identifierRegx.test(token)) {
            return 'identifier'
        } else {
            throw 'invalid token: ' + token;
        }
    },
    getVal: function(token) {
        if (new RegExp(stringConstant).test(token)) {
            return token.replace(/"/g, '');
        } else {
            return token;
        }
    },
    exec: function() {
        return this.tokenize(this.cleanUp());
    }
}


function Compiler(stream) {
    this.tokens = stream;
    this.currentIdx = 0;
    this.symbolTable = new SymbolTable();
    this.VMWriter = null;
    this.className = null;
}

Compiler.prototype = {
    constructor: Compiler,
    advance: function(num) {
        let str = '';
        while (num--) {
            this.currentIdx ++;
        }
        return str;
    },
    throwError: function() {
        let e = new Error('invalid syntax: ' + this.tk().val 
        +', context: ' + this.tk(-3).val+this.tk(-2).val+this.tk(-1).val+this.tk().val+this.tk(1).val);
        throw e;
    },
    //access token
    tk: function(num) {
        return this.tokens[this.currentIdx + (num? num: 0)]
    },
    compileClass: function() {
        //format class className {classVarDec* subRoutineDec*}
        if (this.tk().val === 'class' 
            && this.tk(1).type === 'identifier' 
            && this.tk(2).val === '{' 
            && this.tk(this.tokens.length - 1).val === '}') {
            
            this.className = this.tk(1).val;
            this.VMWriter = new VMWriter(this.className);
            
            this.advance(3);
            this.classVarDec();
            this.subroutineDec();

            if (this.tk().val === '}') {
                this.advance(1);
            } else {
                this.throwError();
            }

        } else {
            this.throwError();
        }
    },
    subroutineDec: function() {
        //format (constructor|function|method) (void|type) subroutineName ( parameterList ) subroutineBody
        while (match(this.tk().val,'constructor','function','method')) {
            let subroutineIdx = this.VMWriter.getIdx();
            let subroutineType = this.tk().val;
            this.symbolTable.startSubroutine();

            //method pass this as argument 0
            if (subroutineType === 'method') {
                this.symbolTable.define('this', this.className, 'arg');
                this.VMWriter.writePush('arg', '0');
                this.VMWriter.writePop('pointer', '0');
            } else if (subroutineType === 'constructor') {
                let objSize = this.symbolTable.varCount('field');
                this.VMWriter.writePush('const', objSize);
                this.VMWriter.writeCall('Memory.alloc', '1');
                this.VMWriter.writePop('pointer', '0');
            }

            this.advance(1);

            
            
            if ((match(this.tk().val,'void',...varType) || this.tk().type === 'identifier') 
            && this.tk(1).type === 'identifier' && this.tk(2).val === '(') {
                let func = this.tk(1).val;
                
                this.advance(3);
                this.parameterList();

                //closing parameterList
                if (this.tk().val === ')') {
                    this.advance(1);
                } else {
                    this.throwError();
                }

                //subroutineBody
                let nLocals = this.subroutineBody();

                //writeFunc
                this.VMWriter.writeFunction(func, nLocals, subroutineIdx);
                
            } else {
                this.throwError();
            }
            
        }
    },
    subroutineBody: function() {
        let varCount = 0;
        // {varDec* statements}
        if (this.tk().val === '{') {
            this.advance(1);
            
            //varDec
            while (this.tk().val === 'var') {
                this.advance(1);
                varCount += this.varDec('var');
            }

            //statements
            this.statements();

            //closing
            if (this.tk().val === '}') {
                this.advance(1);
            } else {
                this.throwError();
            }
        } else {
            this.throwError();
        }
        return varCount
    },
    statements: function() {
        while (match(this.tk().val,'let','if','while','do','return')) {
            switch (this.tk().val) {
                case 'let':
                    this.letStatement();
                    break;
                case 'if':
                    this.ifStatement();
                    break;
                case 'while':
                    this.whileStatement();
                    break;
                case 'do':
                    this.doStatement();
                    break;
                case 'return':
                    this.returnStatement();
                    break;
            }
        }
    },
    letStatement: function() {
        // let varName([  expression  ])? = expression;
        this.advance(1);
        if (this.tk().type === 'identifier') {
            let name = this.tk().val;
            let symbol = this.symbolTable.getIdentifier(name);
            this.advance(1);
            let array = this.tk().val === '['? true: false;

            //array
            if (array) {
                this.VMWriter.writePush(symbol.kind, symbol.idx);
                this.advance(1);
                this.expression();
                this.VMWriter.writeArithmetic('+');
                if (this.tk().val === ']') {
                    this.advance(1);
                } else {
                    this.throwError();
                }
            }

            if (this.tk().val === '=') {
                this.advance(1);
            } else {
                this.throwError();
            }

            this.expression();

            if (array) {
                this.VMWriter.writePop('temp', '0');
                this.VMWriter.writePop('pointer', '1');
                this.VMWriter.writePush('temp', '0');
                this.VMWriter.writePop('that', '0');
            } else {
                this.VMWriter.writePop(symbol.kind, symbol.idx);
            }
            

        } else {
            this.throwError();
        }
        //closing
        if (this.tk().val ===';') {
            this.advance(1);
        } else {
            this.throwError();
        }
    },
    doStatement: function() {
        // do subroutineCall;
        this.advance(1);
        
        this.subroutineCall();
        if (this.tk().val === ';') {
            this.advance(1);
        } else {
            this.throwError();
        }
        this.VMWriter.writePop('temp', '0');
    },
    ifStatement: function() {
        // if (expression) {statements}
        let label1 = this.VMWriter.nameLabel();
        let label2 = this.VMWriter.nameLabel();
        
        this.advance(1);
        if (this.tk().val === '(') {
            this.advance(1);
            this.expression();
            this.VMWriter.writeUnaryOp('~');
            this.VMWriter.writeIf(label1);

            if (this.tk().val === ')' & this.tk(1).val === '{') {
                this.advance(2);
                this.statements();
                this.VMWriter.writeGoto(label2);
            } else {
                this.throwError()
            }

            if (this.tk().val === '}') {
                this.advance(1);
            } else {
                this.throwError()
            }
            this.VMWriter.writeLabel(label1);

            //optional else
            if (this.tk().val === 'else') {
                this.advance(1);
                if (this.tk().val === '{') {
                    this.advance(1);
                    this.statements();
                } else {
                    this.throwError()
                }

                if (this.tk().val === '}') {
                    this.advance(1);
                } else {
                    this.throwError()
                }
            }

            this.VMWriter.writeLabel(label2);

        } else {
            this.throwError();
        }
    },
    whileStatement: function() {
        // while (expression) {statements}
        let label1 = this.VMWriter.nameLabel();
        let label2 = this.VMWriter.nameLabel();
        this.advance(1);
        if (this.tk().val === '(') {
            this.VMWriter.writeLabel(label1);
            this.advance(1);
            this.expression();
            this.VMWriter.writeUnaryOp('~');
            this.VMWriter.writeIf(label2);

            if (this.tk().val === ')' & this.tk(1).val === '{') {
                this.advance(2);
                this.statements();
                this.VMWriter.writeGoto(label1);
            } else {
                this.throwError()
            }

            if (this.tk(0).val === '}') {
                this.advance(1);
                this.VMWriter.writeLabel(label2);
            } else {
                this.throwError()
            }

        } else {
            this.throwError();
        }
    },
    returnStatement: function() {
        // return expression?;
        this.advance(1);
        // push expression first
        if (this.tk().val !== ';') {
            this.expression();

        //void function/method push 0
        } else {
            this.VMWriter.writePush('const', '0');
        }
        if (this.tk().val === ';') {
            this.advance(1);
        } else {
            this.throwError();
        }
        this.VMWriter.writeReturn();
    },
    expression: function() {
        this.term();        

        while (match(this.tk().val,'+','-','*','/','&','|','<','>','=')) {
            //op
            let op = this.tk().val;

            this.advance(1);
            this.term();
            this.VMWriter.writeArithmetic(op);
        }

    },
    term: function() {

        //intergerConstant
        if (this.tk().type === 'integerConstant') {
            this.VMWriter.writePush('const', this.tk().val);
            this.advance(1);
        //stringConstant
        } else if (this.tk().type === 'stringConstant') {
            let string = this.tk().val;
            this.VMWriter.writePush('const', string.length);
            this.VMWriter.writeCall('String.new', '1');

            for (let i = 0; i < string.length; i++) {
                this.VMWriter.writePush('const', string.charCodeAt(i));
                this.VMWriter.writeCall('String.appendChar', '2');
            }
            this.advance(1);
        //keywordConstant
        } else if (match(this.tk().val,'true','false','null','this')) {
            switch (this.tk().val) {
                case 'true':
                    this.VMWriter.writePush('const', '1');
                    this.VMWriter.writeUnaryOp('-');
                    break;
                case 'false':
                    this.VMWriter.writePush('const', '0');
                    break;
                case 'null':
                    this.VMWriter.writePush('const', '0');
                    break;
                case 'this':
                    this.VMWriter.writePush('pointer', '0');
                    break;
            }
            this.advance(1);
        //varName or varName[expression] or subroutineCall
        } else if (this.tk().type === 'identifier') {
            //varName[expression]
            if (this.tk(1).val === '[') {
                let arr = this.tk().val;
                let symbol = this.symbolTable.getIdentifier(arr);

                this.VMWriter.writePush(symbol.kind, symbol.idx);

                this.advance(2);
                this.expression();

                this.VMWriter.writeArithmetic('+');
                this.VMWriter.writePop('pointer', '1');
                this.VMWriter.writePush('that', '0');

                if (this.tk().val === ']') {
                    this.advance(1);
                } else {
                    this.throwError();
                }
            //subroutineCall
            }  else if (match(this.tk(1).val,'(','.')) {
                this.subroutineCall();
            //varName
            } else {
                let symbol = this.symbolTable.getIdentifier(this.tk().val);
                this.VMWriter.writePush(symbol.kind, symbol.idx);
                this.advance(1);
            }
        //( expression )
        } else if (this.tk().val === '(') {
            this.advance(1);
            this.expression();
            if (this.tk().val === ')') {
                this.advance(1);
            } else {
                this.throwError();
            }
        //unaryOp term
        } else if (match(this.tk().val,'-','~')) {
            let op = this.tk().val;
            this.advance(1);
            this.term();
            this.VMWriter.writeUnaryOp(op);
        } else {
            this.throwError();
        }
    },    
    subroutineCall: function() {
        // (className|varName .)? subroutineName( expressionList )
        let func = this.tk().val, funcx, nArgs = 0;
        let obj = this.symbolTable.getIdentifier(func);
        this.advance(1);
        

        //method without obj
        if (this.tk().val === '(') {
            this.advance(1);
        //method with obj & function
        } else if (this.tk().val === '.') {
            funcx = this.tk(1).val;
            
            this.advance(3);
        } else {
            this.throwError();
        }

        //method with object
        if (obj) {
            nArgs++;
            this.VMWriter.writePush(obj.kind, obj.idx);
            func = obj.type + '.' + funcx;

        //method without object
        } else if (!funcx) {
            nArgs++;
            this.VMWriter.writePush('pointer', '0');

        //function, constructor
        } else {
            func = funcx? func+'.'+funcx: func;
        }
        nArgs += this.expressionList();
        this.VMWriter.writeCall(func, nArgs);

        if (this.tk().val === ')') {
            this.advance(1);
        } else {
            this.throwError();
        }
    },

    expressionList: function() {
        let count = 0;
        //expression(, expression)*
        if (this.tk().val !== ')') {
            this.expression();
            count++;

            while (this.tk().val === ',') {
                this.advance(1);
                this.expression();
                count++;
            }
        }
        return count;
    },
    parameterList: function() {
        let kind = 'arg';

        //parameterList type varName (, type varName)*
        if ((match(this.tk().val,...varType) || this.tk().type === 'identifier') && this.tk(1).type === 'identifier') {

            let type = this.tk().val;
            let name = this.tk(1).val;
            this.symbolTable.define(name, type, kind);


            this.advance(2);

            while (this.tk().val === ',' && match(this.tk(1).val,...varType) && this.tk(2).type === 'identifier') {
                let type = this.tk(1).val;
                let name = this.tk(2).val;
                this.symbolTable.define(name, type, kind);

                this.advance(3);
            }
        }

    },
    classVarDec: function() {
        //format (static| field) type varName (, varName)* ;
        while (match(this.tk().val,'static','field')) {
            //update synbol table
            let kind = this.tk().val;

            //xml
            this.advance(1);
            this.varDec(kind);
        }
    },
    varDec: function(kind) {
        let varCount = 0;
        let type = this.tk().val;        
        
        if ((match(this.tk().val,...varType) || this.tk().type === 'identifier') && this.tk(1).type === 'identifier') {
            let name = this.tk(1).val;
            this.symbolTable.define(name, type, kind);
            
            this.advance(2);
            varCount++;
        } else {
            this.throwError();
        }

        while (this.tk().val === ',') {
            this.advance(1);
            if (this.tk().type === 'identifier') {
                let name = this.tk().val;
                this.symbolTable.define(name, type, kind);

                this.advance(1);
                varCount++;
            } else {
                this.throwError();
            }
        }

        if (this.tk().val === ';') {
            this.advance(1);
        } else {
            this.throwError();
        }
        return varCount;
    },
    exec: function() {
        let result = this.compileClass();
        return this.VMWriter.code.join('\n');
    }
}


// check if token matches any expressions
function match(...args) {
    let arr = [...args];
    let token = arr.shift();
    return arr.filter(r => r === token).length === 0? false: true;
}

const fs = require('fs');
const path = require('path');
const dir = path.resolve(__dirname, 'ComplexArrays/');

var files = fs.readdirSync(dir).filter(file => /.jack/.test(file));
for (let file of files) {
    let filePath = path.resolve(__dirname, 'ComplexArrays/'+file);
    let jack = fs.readFileSync(filePath, 'utf-8');
    
    let tokenizer = new Tokenizer(jack);
    let tokenized = tokenizer.exec();
    
    let compiler = new Compiler(tokenized);
    let compiled = compiler.exec();


    let outPath = path.resolve(__dirname, 'ComplexArrays/'+ file.match(/.+(?=\.)/)[0]+'.vm');
    fs.writeFileSync(outPath, compiled);
}


