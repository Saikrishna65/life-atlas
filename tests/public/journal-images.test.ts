import {test} from 'node:test';import assert from 'node:assert/strict';
import {optimizeJournalImage} from '../../src/lib/public-trips/image-source';
test('only configured public sources use responsive Next image sizing; custom hosts keep their originals',()=>{
 for(const source of ['/images/world/mountains.webp','https://pub-synthetic.r2.dev/galleries/photo.bin','https://images.unsplash.com/photo'])assert.equal(optimizeJournalImage(source),true);
 for(const source of ['https://media.my-domain.example/original.jpg','https://private.r2.cloudflarestorage.com/file','http://pub-synthetic.r2.dev/file','https://secret:password@pub-synthetic.r2.dev/file','//unknown.example/file','not a URL'])assert.equal(optimizeJournalImage(source),false);
});
