"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IndexStack = void 0;
const cdk = require("aws-cdk-lib");
const opensearchserverless = require("aws-cdk-lib/aws-opensearchserverless");
class IndexStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const { collection, dataAccessPolicy } = props.openSearchStack;
        // Vector index
        this.vectorIndex = new opensearchserverless.CfnIndex(this, 'VectorIndex', {
            collectionEndpoint: collection.attrCollectionEndpoint,
            indexName: 'unity-vector-index',
            mappings: {
                properties: {
                    'bedrock-knowledge-base-vector': {
                        type: 'knn_vector',
                        dimension: 1024,
                        method: {
                            name: 'hnsw',
                            engine: 'faiss',
                            spaceType: 'l2'
                        }
                    },
                    'AMAZON_BEDROCK_TEXT_CHUNK': { type: 'text' },
                    'AMAZON_BEDROCK_METADATA': { type: 'text', index: false }
                }
            },
            settings: {
                index: { knn: true }
            }
        });
        this.vectorIndex.node.addDependency(dataAccessPolicy);
        // Output
        new cdk.CfnOutput(this, 'IndexName', {
            value: this.vectorIndex.indexName,
            exportName: 'UnityIndexName'
        });
    }
}
exports.IndexStack = IndexStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXhfc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleF9zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtQ0FBbUM7QUFFbkMsNkVBQTZFO0FBTzdFLE1BQWEsVUFBVyxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBR3ZDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDOUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxFQUFFLFVBQVUsRUFBRSxnQkFBZ0IsRUFBRSxHQUFHLEtBQUssQ0FBQyxlQUFlLENBQUM7UUFFL0QsZUFBZTtRQUNmLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxvQkFBb0IsQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtZQUN4RSxrQkFBa0IsRUFBRSxVQUFVLENBQUMsc0JBQXNCO1lBQ3JELFNBQVMsRUFBRSxvQkFBb0I7WUFDL0IsUUFBUSxFQUFFO2dCQUNSLFVBQVUsRUFBRTtvQkFDViwrQkFBK0IsRUFBRTt3QkFDL0IsSUFBSSxFQUFFLFlBQVk7d0JBQ2xCLFNBQVMsRUFBRSxJQUFJO3dCQUNmLE1BQU0sRUFBRTs0QkFDTixJQUFJLEVBQUUsTUFBTTs0QkFDWixNQUFNLEVBQUUsT0FBTzs0QkFDZixTQUFTLEVBQUUsSUFBSTt5QkFDaEI7cUJBQ0Y7b0JBQ0QsMkJBQTJCLEVBQUUsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFO29CQUM3Qyx5QkFBeUIsRUFBRSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRTtpQkFDMUQ7YUFDRjtZQUNELFFBQVEsRUFBRTtnQkFDUixLQUFLLEVBQUUsRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFO2FBQ3JCO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFFdEQsU0FBUztRQUNULElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFFO1lBQ25DLEtBQUssRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLFNBQVU7WUFDbEMsVUFBVSxFQUFFLGdCQUFnQjtTQUM3QixDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUF4Q0QsZ0NBd0NDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcclxuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XHJcbmltcG9ydCAqIGFzIG9wZW5zZWFyY2hzZXJ2ZXJsZXNzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1vcGVuc2VhcmNoc2VydmVybGVzcyc7XHJcbmltcG9ydCB7IE9wZW5TZWFyY2hTdGFjayB9IGZyb20gJy4vb3BlbnNlYXJjaF9zdGFjayc7XHJcblxyXG5pbnRlcmZhY2UgSW5kZXhTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xyXG4gIG9wZW5TZWFyY2hTdGFjazogT3BlblNlYXJjaFN0YWNrO1xyXG59XHJcblxyXG5leHBvcnQgY2xhc3MgSW5kZXhTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XHJcbiAgcHVibGljIHJlYWRvbmx5IHZlY3RvckluZGV4OiBvcGVuc2VhcmNoc2VydmVybGVzcy5DZm5JbmRleDtcclxuXHJcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEluZGV4U3RhY2tQcm9wcykge1xyXG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XHJcblxyXG4gICAgY29uc3QgeyBjb2xsZWN0aW9uLCBkYXRhQWNjZXNzUG9saWN5IH0gPSBwcm9wcy5vcGVuU2VhcmNoU3RhY2s7XHJcblxyXG4gICAgLy8gVmVjdG9yIGluZGV4XHJcbiAgICB0aGlzLnZlY3RvckluZGV4ID0gbmV3IG9wZW5zZWFyY2hzZXJ2ZXJsZXNzLkNmbkluZGV4KHRoaXMsICdWZWN0b3JJbmRleCcsIHtcclxuICAgICAgY29sbGVjdGlvbkVuZHBvaW50OiBjb2xsZWN0aW9uLmF0dHJDb2xsZWN0aW9uRW5kcG9pbnQsXHJcbiAgICAgIGluZGV4TmFtZTogJ3VuaXR5LXZlY3Rvci1pbmRleCcsXHJcbiAgICAgIG1hcHBpbmdzOiB7XHJcbiAgICAgICAgcHJvcGVydGllczoge1xyXG4gICAgICAgICAgJ2JlZHJvY2sta25vd2xlZGdlLWJhc2UtdmVjdG9yJzoge1xyXG4gICAgICAgICAgICB0eXBlOiAna25uX3ZlY3RvcicsXHJcbiAgICAgICAgICAgIGRpbWVuc2lvbjogMTAyNCxcclxuICAgICAgICAgICAgbWV0aG9kOiB7XHJcbiAgICAgICAgICAgICAgbmFtZTogJ2huc3cnLFxyXG4gICAgICAgICAgICAgIGVuZ2luZTogJ2ZhaXNzJyxcclxuICAgICAgICAgICAgICBzcGFjZVR5cGU6ICdsMidcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgICdBTUFaT05fQkVEUk9DS19URVhUX0NIVU5LJzogeyB0eXBlOiAndGV4dCcgfSxcclxuICAgICAgICAgICdBTUFaT05fQkVEUk9DS19NRVRBREFUQSc6IHsgdHlwZTogJ3RleHQnLCBpbmRleDogZmFsc2UgfVxyXG4gICAgICAgIH1cclxuICAgICAgfSxcclxuICAgICAgc2V0dGluZ3M6IHtcclxuICAgICAgICBpbmRleDogeyBrbm46IHRydWUgfVxyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLnZlY3RvckluZGV4Lm5vZGUuYWRkRGVwZW5kZW5jeShkYXRhQWNjZXNzUG9saWN5KTtcclxuXHJcbiAgICAvLyBPdXRwdXRcclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdJbmRleE5hbWUnLCB7XHJcbiAgICAgIHZhbHVlOiB0aGlzLnZlY3RvckluZGV4LmluZGV4TmFtZSEsXHJcbiAgICAgIGV4cG9ydE5hbWU6ICdVbml0eUluZGV4TmFtZSdcclxuICAgIH0pO1xyXG4gIH1cclxufVxyXG4iXX0=