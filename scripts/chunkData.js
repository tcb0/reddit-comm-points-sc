// TODO
// max 1000 {addr:karma} pairs
// const chunkedData = chunkData(classifiedData, 23000);

// fs.writeFileSync(`${dirPathWrite}/${file}`, JSON.stringify(chunkedData));
const isSmallNum = (num) => {
    return parseInt(num) <= 127;
}

const chunkData = (classifiedData, bytesPerBatch) => {

    const addrBytes = 20;
    const smallNumBytes = 1;
    const numBytes = 3;

    const batches = {
        newSingles: [{}],
        newGrouped: [{}],
        repeatingSingles: [{}],
        repeatingGrouped: [{}]
    }

    // chunk new singles
    let totalBytes = 0;
    for(let addr of Object.keys(classifiedData.newSingles)) {
        let recordBytes = addrBytes;
        let karma = classifiedData.newSingles[addr]

        recordBytes += (isSmallNum(karma) ? smallNumBytes : numBytes)

        if(totalBytes + recordBytes > bytesPerBatch) {
            // batch size exceeded, create new batch
            batches.newSingles.push({})
            totalBytes = 0;
        }

        let latestBatch = batches.newSingles[batches.newSingles.length - 1]
        latestBatch[addr] = karma
        totalBytes += recordBytes;
    }

    // chunk repeating singles
    totalBytes = 0;
    for(let id of Object.keys(classifiedData.repeatingSingles)) {
        let recordBytes = 0;
        let karma = classifiedData.repeatingSingles[id]

        recordBytes += (isSmallNum(karma) ? smallNumBytes : numBytes)
        recordBytes += (isSmallNum(id) ? smallNumBytes : numBytes)


        if(totalBytes + recordBytes > bytesPerBatch) {
            // batch size exceeded, create new batch
            batches.repeatingSingles.push({})
            totalBytes = 0;
        }

        let latestBatch = batches.repeatingSingles[batches.repeatingSingles.length - 1]
        latestBatch[id] = karma

        totalBytes += recordBytes;
    }

    // chunk new groups
    totalBytes = 0;
    for (let karma of Object.keys(classifiedData.newGrouped)) {
        let groupBytes = 0;
        let addresses = classifiedData.newGrouped[karma];
        groupBytes += (isSmallNum(karma) ? smallNumBytes : numBytes)
        groupBytes += (isSmallNum(addresses.length) ? smallNumBytes : numBytes)
        groupBytes += addresses.length * addrBytes;

        if(totalBytes + groupBytes > bytesPerBatch) {
            // batch size exceeded, create new batch
            batches.newGrouped.push({})
            totalBytes = 0;
        }

        let latestBatch = batches.newGrouped[batches.newGrouped.length - 1]
        latestBatch[karma] = addresses
        totalBytes += groupBytes;
    }

    // chunk repeating groups
    totalBytes = 0;
    for (let karma of Object.keys(classifiedData.repeatingGrouped)) {
        let groupBytes = 0;
        let ids = classifiedData.repeatingGrouped[karma];
        groupBytes += (isSmallNum(karma) ? smallNumBytes : numBytes)
        groupBytes += (isSmallNum(ids.length) ? smallNumBytes : numBytes)
        groupBytes += ids.reduce((acc, currValue) => {
            return acc + (isSmallNum(currValue) ? smallNumBytes : numBytes)
        });

        if(totalBytes + groupBytes > bytesPerBatch) {
            // batch size exceeded, create new batch
            batches.repeatingGrouped.push({})
            totalBytes = 0;
        }

        let latestBatch = batches.repeatingGrouped[batches.repeatingGrouped.length - 1]
        latestBatch[karma] = ids;
        totalBytes += groupBytes;
    }

    return batches;

};