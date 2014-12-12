/*module Hyperstore {
    interface mongo {

    }

    export class MongoDbAdapter extends Adapter {

        constructor(private url = 'mongodb://localhost:27017/test') {
            super();
        }

        persistElements(session, elements) {
            var self = this;

            mongo.connect(this.url, function (err, db) {
                if (err) {
                    return;
                }

                var col = db.collection('nodes');
                var bulk = col.initializeUnorderedBulkOp();

                var cx = 0;
                elements.forEach(function (element) {
                    if (cx > 900) {
                        console.log("Write 1000...");
                        cx = 0;
                        bulk.execute(function (err, r) {
                            if (err) console.log(err);
                        });
                        bulk = col.initializeUnorderedBulkOp();
                    }

                    switch (element.state) {
                        case 0:
                            var data = {_id: element.id, sc: element.schemaId, ve: element.version};
                            if (element.startId) {
                                data.sid = element.startId;
                                data.eid = element.endId;
                                data.esid = element.endSchemaId;
                                bulk.find({_id: element.startId}).updateOne({$push: {o: element.id}});
                                bulk.find({_id: element.endId}).updateOne({$push: {i: element.id}});
                                cx++;
                                cx++;
                            }
                            bulk.insert(data);
                            cx++;

                        case 2:
                            if (element.properties) {
                                var schemaElement = self.domain.store.getSchemaElement(element.schemaId);
                                for (var pn in element.properties) {
                                    var pv = element.properties[pn];
                                    if (pv && pv.value) {
                                        var ps = schemaElement.getProperty(pn, true);
                                        var data = {_id: element.id + pn, va: ps.serialize(pv.value), ve: pv.version};
                                        bulk.find({_id: element.id + pn}).upsert().updateOne(data);
                                        cx++;
                                    }
                                }
                            }
                            break;

                        case 1:
                            bulk.find({_id: element.id}).deleteOne();
                            cx++;
                            if (element.startId) {
                                bulk.find({_id: element.startId}).updateOne({$pull: {o: element.id}});
                                cx++;
                                bulk.find({_id: element.endId}).updateOne({$pull: {i: element.id}});
                                cx++;
                            }

                            var schemaElement = self.domain.store.getSchemaElement(element.schemaId);
                            Utils.forEach(schemaElement.getProperties(true), function (p) {
                                    bulk.find({_id: element.id + p.name}).deleteOne();
                                    cx++;
                                }
                            );
                            break;
                    }
                });

                if (cx > 0) {
                    console.log("Write final...");
                    bulk.execute(function (err, r) {
                        if (err) console.log(err);
                        db.close();
                    });
                }
                else
                    db.close();
            });
        }
    }
}*/