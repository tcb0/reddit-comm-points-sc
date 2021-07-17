const fs = require("fs");
const {dataDirs, RLP_MULTI_DIGIT_BYTES, RLP_SINGLE_DIGIT_BYTES, SMALL_BYTES, MED_BYTES, GAS_COST_BYTE, BITMAP_CLUSTER_GAP_SIZES} = require('./consts')
const getFileNames = (readDirPath) => {
    let files = fs.readdirSync(readDirPath);
    return files.sort((a, b) => {
        let aSplit = a.split("_");
        let bSplit = b.split("_");
        aRound = parseInt(aSplit[1]);
        bRound = parseInt(bSplit[1]);
        return aRound - bRound;
    });
};

const readData = (dataset = 'bricks', dType = 'json', encType='') => {
    let readDir;
    if(encType) {
        readDir = `${dataDirs[dType]}/${encType}/${dataset}`;
    } else {
        readDir = `${dataDirs[dType]}/${dataset}`;
    }
    const files = getFileNames(readDir)
    let data = {};

    if (dType !== 'encoded') {

        for (let file of files) {
            let fName = file.split('.')[0]
            data[fName] = JSON.parse(fs.readFileSync(`${readDir}/${file}`, 'utf-8'))
        }
    } else {
        for (let file of files) {
            try {
                let subDir = `${readDir}/${file}`;
                let subFiles = fs.readdirSync(subDir)
                let sFileData = {};
                for (let sFile of subFiles) {
                    let fSplit = sFile.split('_')
                    readDataRecursively(fSplit, subDir, sFileData, 0);
                }
                data[file] = sFileData
            } catch (e) {
                // fallback for non directories
                continue;
            }

        }
    }
    return data;

}

const readDataRecursively = (fSplit, basePath, data, index= 0) => {
    if(fSplit.length > 1) {

        if(index === fSplit.length - 1) {
            let fPath = `${basePath}/${fSplit.join('_')}`
            data[fSplit[index]] = fs.readFileSync(fPath)
        } else {
            if(!(fSplit[index] in data)) {
                data[fSplit[index]] = {}
            }
            readDataRecursively(fSplit, basePath, data[fSplit[index]], index + 1)
        }

    } else {
        let fName = fSplit[0];
        data[fName] = fs.readFileSync(`${basePath}/${fName}`);
    }

};



const writeData = (data, dataset = 'bricks', dType = 'grouped', encType) => {
    // data is in the format {'round_1_finalized: {...}, 'round_2_finalized': {...}} -> the keys are the filenames without prefix
    let writeDir;
    if(encType) {
        writeDir = `${dataDirs[dType]}/${encType}/${dataset}`;
    } else {
        writeDir = `${dataDirs[dType]}/${dataset}`;
    }

    if(!fs.existsSync(writeDir)) {
        fs.mkdirSync(writeDir, {recursive: true})
    }

    for (let file in data) {
        let fName = file;
        let fData = data[file];
        if(dType !== 'encoded') {
            fName = `${fName}.json`;
            fData = JSON.stringify(fData);
            fs.writeFileSync(`${writeDir}/${fName}`, fData);
        } else {
            let fileDir = `${writeDir}/${fName}`;
            if(!fs.existsSync(fileDir)) {
                fs.mkdirSync(fileDir)
            }
            writeFilesRecursively(fData, fileDir, '');
        }
    }


}

const writeFilesRecursively = (fData, basePath, path='') => {

    for (let key in fData) {
        let kData = fData[key];
        let fKey = path ? `${path}_${key}` : `${key}`
        if(kData instanceof Uint8Array) {
            fs.writeFileSync(`${basePath}/${fKey}`, kData)
        } else if (kData instanceof Object) {
            writeFilesRecursively(kData, basePath, fKey)
        }
    }

}

const stringifyBigIntReplacer = (key, value) => {
    return typeof value === 'bigint' ? value.toString(2) : value;
};

const writeToFile = (filePath, obj, stringify=true) => {

    let data = obj;

    if(stringify) {
        data = JSON.stringify(obj, stringifyBigIntReplacer)
    }

    fs.writeFileSync(filePath, data)

}

const readFromFile = (filePath) => {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

const getByteSize = (num, mode= "rlp") => {
    // get byte size for num (karma) up to 2 bytes
    num = parseInt(num)
    if(mode === "rlp") {
        return num < 128 ? RLP_SINGLE_DIGIT_BYTES : RLP_MULTI_DIGIT_BYTES;
    } else {
        return num < 256 ? SMALL_BYTES : MED_BYTES;
    }
}

const getByteSizeForRepeatingGroup = (karma, ids, encType) => {
    let byteSizes = ids.map(num => getByteSize(num, encType));
    let itemsTotalByteSize = byteSizes.length ? byteSizes.reduce((acc, curr) => acc + curr) : byteSizes.length;
    return getByteSize(karma, encType) + getByteSize(ids.length, encType) + itemsTotalByteSize;

}



const compressBitmap = (bitmapStr, wordSizeBits = 8) => {

    let tmpId = 0;
    let header = '';
    let compressedBitmap = '';
    let emptyBytes = 0;
    let nonEmptyBytes = 0;
    while(tmpId !== bitmapStr.length) {
        let byte = bitmapStr.slice(tmpId, tmpId + wordSizeBits)

        let isEmpty = true;
        for(let bit of byte) {
            if (bit === '1') {
                isEmpty = false;
                break;
            }
        }

        if (isEmpty) {
            header = `${header}0`
            emptyBytes++;
        } else {
            header = `${header}1`
            compressedBitmap = `${compressedBitmap}${byte}`
            nonEmptyBytes++;
        }

        tmpId += wordSizeBits
    }


    let mod = header.length % wordSizeBits
    let rawBitmap = bitmapStr;
    if(mod !== 0) {
        let headerBitsRemaining = wordSizeBits - mod;
        header = header.padStart(header.length + headerBitsRemaining, '0');
        rawBitmap = rawBitmap.padStart(rawBitmap.length + (headerBitsRemaining) * 8, '0');
    }

    return {
        header,
        rawBitmap,
        compressedBitmap,
        emptyBytes,
        nonEmptyBytes
    }

}


const groupAddresses = (addrs) => {
    let addrsSm = [];
    let addrsMd = []

    for (let addr of addrs) {
        if(isSmallNum(addr)) {
            addrsSm.push(addr);
        } else {
            addrsMd.push(addr);
        }
    }
    return {
        addrsSm,
        addrsMd
    }
}

const getBitmapStatsClusters = (karma, ids, encType='native') => {
    let items = ids.slice();
    let karmaBytes = getByteSize(karma, encType);
    items.sort((a, b) => {
        return a - b;
    })

    let bitmapByteSize = calculateBitmapStats(karma, items, encType).byteSize;

    let addrGroup = groupAddresses(items);

    let addrSmByteSize = 0;
    if(addrGroup.addrsSm.length === 1) {
        addrSmByteSize = 1 + karmaBytes // 1 byte for addr sm + the amount bytes
    } else if(addrGroup.addrsSm.length >  1) {
        addrSmByteSize = getByteSizeForRepeatingGroup(karma, addrGroup.addrsSm, encType);
    }

    let addrMdByteSize = 0;
    if(addrGroup.addrsMd.length === 1) {
        addrMdByteSize = 2 + karmaBytes // 2 bytes for addr md + the amount bytes
    } else if(addrGroup.addrsMd.length >  1) {
        addrMdByteSize = getByteSizeForRepeatingGroup(karma, addrGroup.addrsMd, encType);
    }

    let nativeByteSize = addrSmByteSize + addrMdByteSize;

    let nativeGasCost = nativeByteSize * GAS_COST_BYTE;
    let bitmapGasCost = bitmapByteSize * GAS_COST_BYTE;

    // bitmap strategy works in a hybrid way (it fallback to native when native yields better results)
    if(nativeGasCost < bitmapGasCost) {
        bitmapGasCost = nativeGasCost;
    }

    let clustersPerGapSize = {

    };

    let gasCostMin = Number.MAX_SAFE_INTEGER;
    let hybridGasCostMin = Number.MAX_SAFE_INTEGER;
    let gasCostMinGapSize = 8;

    for(let gapSize of  BITMAP_CLUSTER_GAP_SIZES) {
        let clusters = {};

        let clusterId = 0;
        let minClusterItems = items.length;
        let maxClusterItems = 0;

        let byteSize = 0;
        let gasCost = 0;
        let numClusters = 0;
        let clusteredAddresses = 0;
        let smallClusters = 0;
        let gasSavedOverNative = 0;
        let gasSavedOverBitmaps = 0;

        let prevItem = items[0];
        clusters[clusterId] = {items: [prevItem], stats: {byteSize: 0}};
        let unclusteredAddresses = [];
        for(let item of items.slice(1)) {
            if (((item - prevItem) >= gapSize)) {
                ({clusterId, numClusters, smallClusters, minClusterItems, maxClusterItems, clusteredAddresses, byteSize, unclusteredAddresses} = setInCluster({clusters, clusterId, karma, encType, numClusters, smallClusters, clusteredAddresses, byteSize, minClusterItems, maxClusterItems, unclusteredAddresses}))
                // create new cluster
                clusters[clusterId] = {items: [item], stats: {byteSize: 0}};
            } else {
                clusters[clusterId].items.push(item);
            }
            prevItem = item;
        }

        // handle the last item
        ({clusterId, numClusters, smallClusters, minClusterItems, maxClusterItems, clusteredAddresses, byteSize, unclusteredAddresses} = setInCluster({clusters, clusterId, karma, encType, numClusters, smallClusters, clusteredAddresses, byteSize, minClusterItems, maxClusterItems, unclusteredAddresses}))

        let unclusteredGroup = groupAddresses(unclusteredAddresses);

        let unclusteredSm = 0;
        if(unclusteredGroup.addrsSm.length === 1) {
            unclusteredSm = 1 + karmaBytes // 1 byte for addr sm + the amount bytes
        } else if(unclusteredGroup.addrsSm.length >  1) {
            unclusteredSm = getByteSizeForRepeatingGroup(karma, unclusteredGroup.addrsSm, encType);
        }

        let unclusteredMd = 0;
        if(unclusteredGroup.addrsMd.length === 1) {
            unclusteredMd = 2 + karmaBytes // 2 bytes for addr md + the amount bytes
        } else if(unclusteredGroup.addrsMd.length >  1) {
            unclusteredMd = getByteSizeForRepeatingGroup(karma, unclusteredGroup.addrsMd, encType);
        }

        byteSize += (unclusteredMd + unclusteredSm)

        gasCost = byteSize * GAS_COST_BYTE;
        gasSavedOverBitmaps = bitmapGasCost - gasCost;
        gasSavedOverNative = nativeGasCost - gasCost;

        let costs = [gasCost, bitmapGasCost, nativeGasCost];
        let hybridGasCost = Math.min(...costs);


        if(gasCost < gasCostMin) {
            gasCostMin = gasCost;
            gasCostMinGapSize = gapSize
        }

        if(hybridGasCost < hybridGasCostMin) {
            hybridGasCostMin = hybridGasCost;
        }

        clustersPerGapSize[gapSize] = {
            clusters: clusters,
            numClusters: numClusters,
            smallClusters: smallClusters,
            minClusterItems: minClusterItems,
            maxClusterItems: maxClusterItems,
            byteSize: byteSize,
            gasCost: gasCost,
            hybridGasCost: hybridGasCost,
            clusteredAddresses: clusteredAddresses,
            gasSavedOverNative: gasSavedOverNative,
            gasSavedOverBitmaps: gasSavedOverBitmaps
        };

    }


    return {
        clustersPerGapSize: clustersPerGapSize,
        bitmapGasCost: bitmapGasCost,
        nativeGasCost: nativeGasCost,
        gasCostMin: gasCostMin,
        hybridGasCostMin: hybridGasCostMin,
        gasCostMinGapSize: gasCostMinGapSize
    };
}


const setInCluster = (params) => {
    let {clusters, clusterId, karma, encType, numClusters, smallClusters, clusteredAddresses, byteSize, minClusterItems, maxClusterItems, unclusteredAddresses} = params;
    // previous cluster stats
    let itemsPrevCluster = clusters[clusterId].items;
    if(itemsPrevCluster.length > maxClusterItems) {
        maxClusterItems = itemsPrevCluster.length;
    }

    if (itemsPrevCluster.length < minClusterItems) {
        minClusterItems = itemsPrevCluster.length;
    }


    if(itemsPrevCluster.length > 3) {
        let stats = calculateBitmapStats(karma, itemsPrevCluster, encType);
        clusters[clusterId].stats = {
          byteSize: stats.byteSize,
          numItems: itemsPrevCluster.length
        };
        numClusters++;
        clusteredAddresses += itemsPrevCluster.length;
        byteSize += clusters[clusterId].stats.byteSize;
        delete clusters[clusterId].items;
        clusterId++;
    } else {
        unclusteredAddresses = unclusteredAddresses.concat(itemsPrevCluster)
        smallClusters++;
        delete clusters[clusterId];

    }

    return {clusterId, numClusters, smallClusters, minClusterItems, maxClusterItems, clusteredAddresses, byteSize, unclusteredAddresses}
}


const getBitmapStats = (karma, ids, encType) => {

    let items = ids.slice();
    items.sort((a, b) => {
        return a - b;
    })

    console.log("sorted items", items.slice(0,5), items.slice(items.length - 5));

    return calculateBitmapStats(karma, items, encType)

}


const calculateBitmapStats = (karma, items, encType) => {


    let startId = items[0]
    let endId = items[items.length - 1];
    let range = (endId - startId) + 1;
    let projectedItems = items.map(item => item - startId)
    console.log("projected items", projectedItems.slice(0,5), projectedItems.slice(projectedItems.length - 5))
    let bitmap = BigInt(0)

    for (let item of projectedItems) {
        bitmap = bitmap | (BigInt(1) << BigInt(item));
    }

    let mod = range % 8;
    let bits = range;
    if(mod !== 0) {
        let bitsRemaining = 8 - mod;
        bits += bitsRemaining;
    }


    let rawBitmap = bitmap.toString(2);

    // pad bitmap with zeroes
    rawBitmap = rawBitmap.padStart(bits, '0')

    console.log("raw bitmap", rawBitmap)
    let compressRes = compressBitmap(rawBitmap);

    let headerBytes = compressRes.header.length / 8
    let totalBitmapBytes = headerBytes + compressRes.nonEmptyBytes;


    console.log("compressed bitmap", compressRes.compressedBitmap)
    console.log("header", compressRes.header)

    console.log("raw bitmap length", rawBitmap.length);
    console.log("compressed bitmap length", compressRes.compressedBitmap.length);
    console.log("header length", compressRes.header.length);
    console.log("compressed bitmap bytes", compressRes.nonEmptyBytes);
    console.log("total bytes", totalBitmapBytes);

    let byteSize = getByteSize(karma, encType) + getByteSize(startId, encType) + getByteSize(range, encType) + getByteSize(headerBytes, encType) + totalBitmapBytes

    return {
        startId,
        range,
        headerBytes,
        header: compressRes.header,
        rawBitmap: compressRes.rawBitmap,
        compressedBitmap: compressRes.compressedBitmap,
        byteSize,
        karma
    }

}

const isSmallNum = (num) => {
    return parseInt(num) <= 255;
}


const groupByKarma = (data) => {
    const amountGroups = {};
    for (let item of data) {

        if(amountGroups[item.karma]) {
            amountGroups[item.karma].push(item.addrOrId)
        } else {
            amountGroups[item.karma] = [item.addrOrId]
        }
    }

    // get amount groups with more than 1 item in the group
    const filteredAmountGroups = {};
    const singles = {};
    for (let karma of Object.keys(amountGroups)) {
        if (amountGroups[karma].length > 1) {
            filteredAmountGroups[karma] = amountGroups[karma];
        } else {
            let addrOrId = amountGroups[karma][0]
            singles[addrOrId] = karma;
        }
    }

    return {groups: filteredAmountGroups, singles };
}

const filterNewAndRepeatingItems = (data, index) => {

    const newItems = [];
    const repeatingItems = [];

    for (let item of data) {

        if(item.address in index) {
            repeatingItems.push({
                addrOrId: index[item.address],
                karma: item.karma
            })
        } else {
            newItems.push({
                addrOrId: item.address,
                karma: item.karma
            })
            index[item.address] = Object.keys(index).length
        }

    }
    return {
        newItems,
        repeatingItems
    }

}



module.exports = {
    getByteSizeForRepeatingGroup,
    getBitmapStats,
    getBitmapStatsClusters,
    getFileNames,
    readData,
    writeData,
    readFromFile,
    writeToFile,
    stringifyBigIntReplacer,
    getByteSize,
    isSmallNum,
    groupAddresses,
    groupByKarma,
    filterNewAndRepeatingItems
}