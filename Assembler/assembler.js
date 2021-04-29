// const fetch = require("node-fetch");

// fetch('file:///Users/thaonguyen/Documents/nand2tetris/projects/06/add/Add.asm')
// .then(response => response.json())
// .then(data => console.log(data))


const fs = require('fs');
const readline = require('readline');
const path = require('path');
const { once } = require('events');

const file = path.resolve(__dirname, 'pong/Pong.asm');
const convertedFile = path.resolve(__dirname, 'pong/Pong.hack');


var comments = /\/{2}.+/;
var aRegex = /@(.+)/;
var destReg = /(.+)=/;
var jumpReg = /;(.+)/;
var labelReg = /\((.+)\)/;
var variableReg = /@\D+/;
var variableCapture = /@(.+)/;

var symbolLoc = 16;
var labelCounter = 0;
var codes = [];



(async () => {
    try {
        const rl = readline.createInterface({
            input: fs.createReadStream(file),
            crlfDelay: Infinity
        });

        rl.on('line', (line) => {
            var newline = line;
            newline = newline.replace(comments, '').trim();
            if (newline!=='') {
                codes.push(newline);
            }
            
        })
        await once(rl, 'close');

        //add symbols
        //labels
        codes.forEach((code, i) => {
            if (labelReg.test(code)) {
                let s = code.match(labelReg)[1];
                symbolsDec[s]? s: symbolsDec[s] = i - labelCounter;
                labelCounter++;
            }
        })
        //variables to addresses
        codes = codes.map(code => {
            if (variableReg.test(code)) {
                let v = code.match(variableCapture)[1];
                if (symbolsDec[v] === undefined) {
                    symbolsDec[v] = symbolLoc;
                    symbolLoc++;
                }
                code = code.replace(v, symbolsDec[v]);
            }
            return code
        })

        //drop labels
        codes = codes
            .filter(code => !labelReg.test(code))

        console.log(codes);


        //convert to binary
        codes = codes.map(code => {
            if (aRegex.test(code)) {
                let n = code.match(aRegex)[1];
                let binary = binaryConverter(n);
                return fill0(binary, 16);
            } else {
                return parser(code);
            }
        })

        fs.writeFile(convertedFile, codes.join('\n'), (err) => {
            if (err) {
                return console.log(err)
            }
            console.log('file written')
        })
    } catch (err) {
        console.error(err)
    }
})()

//functions
function binaryConverter(n) {
    n = parseInt(n);
    var binary = '';
    var r = 0;
    if (n===0) binary = '0';
    while (n > 0) {
        r = n%2;
        binary = r + binary;
        n = Math.floor(n/2);
    }
    return binary
}

function fill0(str, size) {
    while(str.length<size) {
        str = '0' + str;
    }
    return str
}

function parser(string) {
    var dest = string.match(destReg)? string.match(destReg)[1]: null;
    var jump = string.match(jumpReg)? string.match(jumpReg)[1]: null;
    var comp = string.replace(destReg, '').replace(jumpReg, '');

    return '111'+compCode[comp]+destCode[dest]+jumpCode[jump]
}


//machine code
const destCode = {
    null: '000',
    M: '001',
    D: '010',
    MD: '011',
    A: '100',
    AM: '101',
    AD: '110',
    AMD: '111'
};

const jumpCode = {
    null: '000',
    JGT: '001',
    JEQ: '010',
    JGE: '011',
    JLT: '100',
    JNE: '101',
    JLE: '110',
    JMP: '111'
}

const compCode = {
    '0': '0101010',
    '1': '0111111',
    '-1': '0111010',
    'D': '0001100',
    'A': '0110000',
    '!D': '0001101',
    '!A': '0110001',
    '-D': '0001111',
    '-A': '0110011',
    'D+1': '0011111',
    'A+1': '0110111',
    'D-1': '0001110',
    'A-1': '0110010' ,
    'D+A': '0000010' ,
    'D-A': '0010011' ,
    'A-D': '0000111' ,
    'D&A': '0000000' ,
    'D|A': '0010101' ,
    'M': '1110000',
    '!M': '1110001',
    '-M': '1110011',
    'M+1': '1110111' ,
    'M-1': '1110010' ,
    'D+M': '1000010' ,
    'D-M': '1010011' ,
    'M-D': '1000111' ,
    'D&M': '1000000' ,
    'D|M': '1010101'
}


var symbolsDec = {
    SP: 0,
    LCL: 1,
    ARG: 2,
    THIS: 3,
    THAT: 4,
    SCREEN: 16384,
    KBD: 24576,
    R0: 0,
    R1: 1,
    R2: 2,
    R3: 3,
    R4: 4,
    R5: 5,
    R6: 6,
    R7: 7,
    R8: 8,
    R9: 9,
    R10: 10,
    R11: 11,
    R12: 12,
    R13: 13,
    R14: 14,
    R15: 15
}