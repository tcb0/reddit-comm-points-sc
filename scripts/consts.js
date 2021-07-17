
const ADDR_BYTES = 20;
const RLP_SINGLE_DIGIT_BYTES = 1;
const SMALL_BYTES = 1;
const MED_BYTES = 2;
const RLP_MULTI_DIGIT_BYTES = 3;
const BATCH_TYPE_BYTES = 1;
const BITMASK_BYTES = 13;
const GAS_COST_BYTE = 16;


const dataDirs = {
    raw: 'data/raw',
    encoded: 'data/encoded',
    decoded: 'data/decoded',
    grouped: 'data/grouped',
    sizeStats: 'data/stats/size',
    generalStats: 'data/stats/general',
    groupingStats: 'data/stats/grouping',
    groupingMetadata: 'data/stats/groupingMetadata',
    json: 'data/json',
    addrIndex: 'data/addrIndex',
    table: 'data/stats/table'
}

const statsTemplateRlp = {
    gasCosts: {
        newSingles: 0,
        newGrouped: 0,
        repeatingSingles: 0,
        repeatingGrouped: 0,
        total: 0
    },
    byteSizes: {
        newSingles: 0,
        newGrouped: 0,
        repeatingSingles: 0,
        repeatingGrouped: 0,
        total: 0
    }
}

const nativeTemplate = {
    newSingles: {},
    newGrouped: {},
    repeatingSingles: {},
    repeatingGrouped: {}
}

const BITMAP_CLUSTER_GAP_SIZES = [8, 16, 24, 32, 64, 128, 256]

const getNativeTemplateWithBitmaps = () => {

    return JSON.parse(JSON.stringify({...nativeTemplate, repeatingGroupedBitmaps: {}}))
}


const getStatsTemplateRlp = () => {
    return JSON.parse(JSON.stringify(statsTemplateRlp))
}

const getStatsTemplateNativeWithCosts = () => {

    return {
        gasCosts: JSON.parse(JSON.stringify({...nativeTemplate, total: 0})),
        byteSizes: JSON.parse(JSON.stringify({...nativeTemplate, total: 0})),
    };

}

const getNativeTemplate = () => {
    return JSON.parse(JSON.stringify(nativeTemplate))
}


const groupsBitKeys = {
    rlpSingleNew: {
      bin: '00000000'
    },
    rlpGroupNew: {
      bin: '00000010'
    },
    rlpSingleRepeat: {
      bin: '00000100'
    },
    rlpGroupRepeat: {
      bin: '00000110'
    },
    nativeSingleNewAmountSmall: {
      bin: '00001001'
    },
    nativeSingleNewAmountMed: {
      bin: '00000001'
    },
    nativeGroupNewAmountSmallAddrLenSmall: {
      bin: '00101011'
    },
    nativeGroupNewAmountSmallAddrLenMed: {
      bin: '00001011'
    },
    nativeGroupNewAmountMedAddrLenSmall: {
      bin: '00100011'
    },
    nativeGroupNewAmountMedAddrLenMed: {
      bin: '00000011'
    },
    nativeSingleRepeatAmountSmallAddrSmall: {
      bin: '00011101'
    },
    nativeSingleRepeatAmountSmallAddrMed: {
      bin: '00001101'
    },
    nativeSingleRepeatAmountMedAddrSmall: {
      bin: '00010101'
    },
    nativeSingleRepeatAmountMedAddrMed: {
      bin: '00000101'
    },
    nativeGroupRepeatAmountSmallAddrLenSmallAddrSmall: {
      bin: '00111111'
    },
    nativeGroupRepeatAmountSmallAddrLenSmallAddrMed: {
        bin: '00101111'
    },
    nativeGroupRepeatAmountSmallAddrLenMedAddrSmall: {
        bin: '00011111'
    },
    nativeGroupRepeatAmountSmallAddrLenMedAddrMed: {
        bin: '00001111'
    },
    nativeGroupRepeatAmountMedAddrLenSmallAddrSmall: {
        bin: '00110111'
    },
    nativeGroupRepeatAmountMedAddrLenSmallAddrMed: {
        bin: '00100111'
    },
    nativeGroupRepeatAmountMedAddrLenMedAddrSmall: {
        bin: '00010111'
    },
    nativeGroupRepeatAmountMedAddrLenMedAddrMed: {
        bin: '00000111'
    },
    bitmaskAmountSmallHeaderNumSmallRangeSmallStartIdSmall: {
        bin: '11111111'
    },
    bitmaskAmountSmallHeaderNumSmallRangeSmallStartIdMed: {
        bin: '10111111'
    },
    bitmaskAmountSmallHeaderNumSmallRangeMedStartIdSmall: {
        bin: '11011111'
    },
    bitmaskAmountSmallHeaderNumSmallRangeMedStartIdMed: {
        bin: '10011111'
    },
    bitmaskAmountSmallHeaderNumMedRangeSmallStartIdSmall: {
        bin: '11101111'
    },
    bitmaskAmountSmallHeaderNumMedRangeSmallStartIdMed: {
        bin: '10101111'
    },
    bitmaskAmountSmallHeaderNumMedRangeMedStartIdSmall: {
        bin: '11001111'
    },
    bitmaskAmountSmallHeaderNumMedRangeMedStartIdMed: {
        bin: '10001111'
    },
    bitmaskAmountMedHeaderNumSmallRangeSmallStartIdSmall: {
        bin: '11110111'
    },
    bitmaskAmountMedHeaderNumSmallRangeSmallStartIdMed: {
        bin: '10110111'
    },
    bitmaskAmountMedHeaderNumSmallRangeMedStartIdSmall: {
        bin: '11010111'
    },
    bitmaskAmountMedHeaderNumSmallRangeMedStartIdMed: {
        bin: '10010111'
    },
    bitmaskAmountMedHeaderNumMedRangeSmallStartIdSmall: {
        bin: '11100111'
    },
    bitmaskAmountMedHeaderNumMedRangeSmallStartIdMed: {
        bin: '10100111'
    },
    bitmaskAmountMedHeaderNumMedRangeMedStartIdSmall: {
        bin: '11000111'
    },
    bitmaskAmountMedHeaderNumMedRangeMedStartIdMed: {
        bin: '10000111'
    }
};
const groupBitFlags = {
    first: true
}
const getGroupBitKeys = () => {
    if(!groupBitFlags.first) return groupsBitKeys;

    for (let key in groupsBitKeys) {
        let bin = groupsBitKeys[key]['bin']
        groupsBitKeys[key]['dec'] = parseInt(bin, 2);
    }
    groupBitFlags.first = false;
    return groupsBitKeys;
}

module.exports = {
    getGroupBitKeys,
    dataDirs,
    getStatsTemplateRlp,
    getNativeTemplate,
    getNativeTemplateWithBitmaps,
    getStatsTemplateNativeWithCosts,
    ADDR_BYTES,
    RLP_SINGLE_DIGIT_BYTES,
    RLP_MULTI_DIGIT_BYTES,
    BATCH_TYPE_BYTES,
    BITMASK_BYTES,
    SMALL_BYTES,
    MED_BYTES,
    GAS_COST_BYTE,
    BITMAP_CLUSTER_GAP_SIZES
}