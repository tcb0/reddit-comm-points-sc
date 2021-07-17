const fs = require('fs');
const {dataDirs} = require('./consts')
const yargs = require('yargs');
const { printTable } = require('./table')

const argv = yargs
    .command('compute', 'Compute stats', {
        dataset: {
            description: 'the dataset to check for',
            alias: 'd',
            type: 'string',
            default: 'bricks'
        },
        naive: {
            description: 'calculate naive gas costs',
            alias: 'n',
            type: 'boolean',
            default: true
        },
        compressed: {
            description: 'calculate compressed gas costs',
            alias: 'cmp',
            type: 'boolean',
            default: true
        },
        compressedMasks: {
            description: 'calculate compressed bitmask gas costs',
            alias: 'cmpb',
            type: 'boolean',
            default: true
        },
        cache: {
            alias: 'c',
            description: 'use cached results',
            type: 'boolean',
            default: false
        }
    })
    .command('convert', 'Convert raw csv data into json')
    .command('group', 'Group data', {
        chunk: {
            description: 'chunk the groups into chunks of approximately equal size',
            alias: 'chunk',
            type: 'boolean',
            default: false
        }
    })
    .command('chunk', 'Chunk the parsed data into groups', {
        bytesPerChunk: {
            description: 'chunk the data into groups, where each group is of max bytesPerChunk bytes',
            alias: 'bytes',
            type: 'number',
            default: 20000
        }
    })
    .command('encode', 'Encode the data')
    .command('decode', 'Decode the data')
    .command('verify', 'Verify if the data is properly encoded')
    .command('stats', 'Make general stats for dataset and encType')
    .command('referencingStats', 'Make referencingStats for dataset')
    .command('table', 'Print markdown table from stats data, based on the `type` param', {
        type: {
            description: 'The type of table to print',
            alias: 'type',
            type: 'string',
            default: 'comparison'
        }
    })
    .command('batchMint', 'Batch mint subreddit points', {
        round: {
            description: 'the round to be batch minted',
            alias: 'r',
            type: 'number',
            default: 1
        }
    })
    .option('encType', {
        alias: 'encType',
        description: 'the number encoding type',
        type: 'string',
        choices: ['rlp', 'native', 'bitmap', 'bitmapCluster'],
        default: 'rlp'
    })
    .option('dataset', {
        alias: 'd',
        description: 'the dataset to operate on',
        type: 'string',
        choices: ['bricks', 'moons'],
        default: 'bricks'
    })
    .help()
    .alias('help', 'h')
    .argv;


if (argv._.includes('convert')) {
    convertData(argv);
} else if (argv._.includes('compute')) {
    computeStats(argv);
} else if (argv._.includes('group')) {
    groupData(argv)
} else if (argv._.includes('encode')) {
    encodeData(argv)
} else if (argv._.includes('decode')) {
    decodeData(argv)
} else if (argv._.includes('verify')) {
    verifyData(argv)
} else if (argv._.includes('referencingStats')) {
    groupReferencingStats(argv)
} else if (argv._.includes('stats')) {
    generalStats(argv)
} else if (argv._.includes('table')) {
    printTable(argv)
} else {

    if(fs.existsSync(dataDirs.json)) {
        fs.rmdirSync(dataDirs.json)
    }

    if(fs.existsSync(dataDirs.grouped)) {
        fs.rmdirSync(dataDirs.grouped)
    }

    if(fs.existsSync(dataDirs.encoded)) {
        fs.rmdirSync(dataDirs.encoded)
    }

    if(fs.existsSync(dataDirs.decoded)) {
        fs.rmdirSync(dataDirs.decoded)
    }

    if(fs.existsSync(dataDirs.stats)) {
        fs.rmdirSync(dataDirs.stats)
    }

    convertData({dataset: 'bricks'})
    convertData({dataset: 'moons'})

    groupData({dataset: 'bricks', encType: 'rlp'})
    groupData({dataset: 'bricks', encType: 'native'})
    groupData({dataset: 'moons', encType: 'rlp'})
    groupData({dataset: 'moons', encType: 'native'})

    encodeData({dataset: 'bricks', encType: 'rlp'})
    encodeData({dataset: 'bricks', encType: 'native'})
    encodeData({dataset: 'moons', encType: 'rlp'})
    encodeData({dataset: 'moons', encType: 'native'})

    decodeData({dataset: 'bricks', encType: 'rlp'})
    decodeData({dataset: 'bricks', encType: 'native'})
    decodeData({dataset: 'moons', encType: 'rlp'})
    decodeData({dataset: 'moons', encType: 'native'})

    verifyData({dataset: 'bricks', encType: 'rlp'})
    verifyData({dataset: 'bricks', encType: 'native'})
    verifyData({dataset: 'moons', encType: 'rlp'})
    verifyData({dataset: 'moons', encType: 'native'})

    computeStats({dataset: 'bricks', encType: 'rlp'})
    computeStats({dataset: 'bricks', encType: 'native'})
    computeStats({dataset: 'moons', encType: 'rlp'})
    computeStats({dataset: 'moons', encType: 'native'})
}