var comments = /\/{2}.+/;

const fs = require('fs');
const readline = require('readline');
const path = require('path');
const { once } = require('events');

const fileName = 'FibonacciElement';
const dir = path.resolve(__dirname, 'FunctionCalls/FibonacciElement/');
const output = path.resolve(__dirname, 'FunctionCalls/FibonacciElement/FibonacciElement.asm');



var codes = [
    'call Sys.init 0'
];

(async () => {
    try {
        var files = fs.readdirSync(dir).filter(file => (/.vm/.test(file)));
        for (let file of files) {
            file = path.resolve(__dirname, 'FunctionCalls/FibonacciElement/'+file);
            const rl = readline.createInterface({
                input: fs.createReadStream(file),
                crlfDelay: Infinity
            });
    
            rl.on('line', (line) => {
                var newLine = line.replace(comments, '').trim();
                if (newLine!=='') {
                    codes.push(newLine)
                }
            });
            await once(rl, 'close');
        }
        
        codes = codes.map((code, index) => {
            // push, pop
            if (code.split(' ')[0] === 'push'|'pop') {
                return memoryTranslator(code);
            // label, if-goto, goto
            } else if (code.split(' ').length === 2) {
                return flowTranslator(code);
            // function
            } else if (code.split(' ')[0] === 'function') {
                return createFunc(code);
            // call function
            } else if (code.split(' ')[0] === 'call') {
                return callF(code);
            } else if (code.split(' ')[0] === 'return') {
                return returnTranslator();
            } else {
                return arithmeticTranslator(code, index)
            }
        })

        codes.unshift([
            '@256',
            'D=A',
            '@SP',
            'M=D'
        ])
        
        codes = codes.map(code => code.join('\n')).join('\n');
        

        fs.writeFile(output, codes, (err) => {
            if (err) {
                console.log(err)
            } else {
                console.log('file created')
            }
        })
    } catch (err) {
        console.log(err);
    }
})()


//get val from SP
const popTemplate = [
    '@SP',
    'M=M-1',
    'A=M',
    'D=M'
];

//push val to SP and move SP
const pushTemplate = [
    '@SP',
    'A=M',
    'M=D',
    '@SP',
    'M=M+1'
];

//translator functions
function returnTranslator() {
    let states = ['THAT', 'THIS', 'ARG', 'LCL'].map(state => {
        let recovery = [
            'A=M',
            'D=M',
            `@${state}`,
            'M=D',
            '@frame',
            'M=M-1'
        ]
        return recovery
    }).flat()

    let asm = [
        //pop argument 0
        ...popTemplate,
        '@ARG',
        'A=M',
        'M=D',
        //move SP to after argument 0
        '@ARG',
        'D=M',
        '@SP',
        'M=D+1',
        //set up frame at that
        '@LCL',
        'D=M',
        '@frame',
        'M=D-1',
        ...states,
        //jump to return address
        'A=M',
        'A=M',
        '0;JMP'
    ]

    return asm
}

var funcTracker = [];
function createFunc(code) {
    let f = code.split(' ')[1];
    let nLocals = code.split(' ')[2];

    funcTracker.push(f);

    let func = [
        `(${f})`,
        '@count',
        'D=M',
        `@${nLocals}`,
        'D=A-D',
        `@${f}$LOCAL_DONE`,
        'D;JEQ',
        '@0',
        'D=A',
        ...pushTemplate,
        '@count',
        'M=M+1',
        `@${f}`,
        '0;JMP',
        `(${f}$LOCAL_DONE)`
    ]

    return func
}


var callTracker = {};
function callF(code) {
    let func = code.split(' ')[1];
    let nArgs = code.split(' ')[2];

    callTracker[func]? callTracker[func]++: callTracker[func] = 1;

    let returnAddr = func+'$ret.'+callTracker[func];

    let call = [
        //push return address to stack
        `@${returnAddr}`,
        'D=A',
        ...pushTemplate,
        //save current LCL, ARG, THIS, THAT by pushing to stack
        '@LCL',
        'D=M',
        ...pushTemplate,
        '@ARG',
        'D=M',
        ...pushTemplate,
        '@THIS',
        'D=M',
        ...pushTemplate,
        '@THAT',
        'D=M',
        ...pushTemplate,
        //set new ARG base
        '@5',
        'D=A',
        `@${nArgs}`,
        'D=D+A',
        '@SP',
        'D=M-D',
        '@ARG',
        'M=D',
        //set LCL
        '@SP',
        'D=M',
        '@LCL',
        'M=D',
        //go to func
        `@${func}`,
        '0;JMP',
        //set return label
        `(${returnAddr})`
    ]

    return call

}

function flowTranslator(code) {
    let command = code.split(' ')[0];
    let label = code.split(' ')[1];
    let labelFormat = funcTracker[funcTracker.length-1] +'$' + label;

    let flow = {
        label: [
            `(${labelFormat})`
        ],
        'if-goto': [
            '@SP',
            'M=M-1',
            'A=M',
            'D=M',
            `@${labelFormat}`,
            'D;JNE'
        ],
        goto: [
            `@${labelFormat}`,
            '0;JMP'
        ]
    }
    return flow[command]
}

function arithmeticTranslator(code, index) {
    let operator = arithmeticTree[code].operator;
    let operands = arithmeticTree[code].operands;
    let template = arithmeticTree[code].template;

    let arithmetic = {
        compute: {
            xy: [
                '@SP', 
                'M=M-1', 
                'A=M',
                'D=M',
                '@SP',
                'M=M-1',
                'A=M',
                template,
                '@SP',
                'M=M+1'
            ],
            y: [
                '@SP',
                'M=M-1',
                'A=M',
                template,
                '@SP',
                'M=M+1'
            ]
        },
        compare: {
            xy: [
                '@boolean',
                'M=-1',
                '@SP',
                'M=M-1',
                'A=M',
                'D=M',
                '@SP',
                'M=M-1',
                'A=M',
                'D=M-D',
                `@END ${index}`,
                template,
                '@boolean',
                'M=0',
                `(END ${index})`,
                '@boolean',
                'D=M',
                '@SP',
                'A=M',
                'M=D',
                '@SP',
                'M=M+1'
            ]
        }
    }

    return arithmetic[operator][operands]
}

function memoryTranslator(code) {
    let codeArr = code.split(' ');
    let command = codeArr[0];
    let segment = codeArr[1];
    let i = codeArr[2];

    let commandType = memoryTree[segment]!== undefined? 'regular': segment;
    let segCode = memoryTree[segment];

    let memoryAccess = {
        push: {
            //local, argument, this, that
            regular: [
                `@${i}`,
                'D=A',
                `@${segCode}`,
                'A=M+D',
                'D=M',
                ...pushTemplate
            ],
            constant: [
                `@${i}`,
                'D=A',
                ...pushTemplate
            ],
            static: [
                `@${fileName}.${i}`,
                'D=M',
                '@SP',
                ...pushTemplate
            ],
            temp: [
                `@${i}`,
                'D=A',
                '@5',
                'A=A+D',
                'D=M',
                ...pushTemplate
            ],
            pointer: [
                `@${i === '0'? 'THIS': 'THAT'}`,
                'D=M'
                ,...pushTemplate
            ]
        },
        pop: {
            regular: [
                `@${i}`,
                'D=A',
                `@${segCode}`,
                'A=M+D',
                'D=A',
                '@addr',
                'M=D',
                ...popTemplate,
                '@addr',
                'A=M',
                'M=D'
            ],
            static: [
                ...popTemplate,
                `@${fileName}.${i}`,
                'M=D'
            ],
            temp: [
                `@${i}`,
                'D=A',
                '@5',
                'A=A+D',
                'D=A',
                '@addr',
                'M=D',
                ...popTemplate,
                '@addr',
                'A=M',
                'M=D'
            ],
            pointer: [
                ...popTemplate,
                `@${i=== '0'? 'THIS': 'THAT'}`,
                'M=D'
            ]
        }
    }

    return memoryAccess[command][commandType]
}

//info trees, templates
const arithmeticTree = {
    add: {
        operator: 'compute',
        operands: 'xy',
        template: 'M=M+D'
    },
    sub: {
        operator: 'compute',
        operands: 'xy',
        template: 'M=M-D'
    },
    and: {
        operator: 'compute',
        operands: 'xy',
        template: 'M=M&D'
    },
    or: {
        operator: 'compute',
        operands: 'xy',
        template: 'M=M|D'
    },
    neg: {
        operator: 'compute',
        operands: 'y',
        template: 'M=-M'
    },
    not: {
        operator: 'compute',
        operands: 'y',
        template: 'M=!M'
    },
    eq: {
        operator: 'compare',
        operands: 'xy',
        template: 'D;JEQ'
    },
    gt: {
        operator: 'compare',
        operands: 'xy',
        template: 'D;JGT'
    },
    lt: {
        operator: 'compare',
        operands: 'xy',
        template: 'D;JLT'
    }
};

const memoryTree = {
    local: 'LCL',
    argument: 'ARG',
    this: 'THIS',
    that: 'THAT'
}

