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
            indexName: 'bedrock-knowledge-base-index',
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
            exportName: 'VectorIndexName'
        });
    }
}
exports.IndexStack = IndexStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXhfc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleF9zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtQ0FBbUM7QUFFbkMsNkVBQTZFO0FBTzdFLE1BQWEsVUFBVyxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBR3ZDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDOUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxFQUFFLFVBQVUsRUFBRSxnQkFBZ0IsRUFBRSxHQUFHLEtBQUssQ0FBQyxlQUFlLENBQUM7UUFFL0QsZUFBZTtRQUNmLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxvQkFBb0IsQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtZQUN4RSxrQkFBa0IsRUFBRSxVQUFVLENBQUMsc0JBQXNCO1lBQ3JELFNBQVMsRUFBRSw4QkFBOEI7WUFDekMsUUFBUSxFQUFFO2dCQUNSLFVBQVUsRUFBRTtvQkFDViwrQkFBK0IsRUFBRTt3QkFDL0IsSUFBSSxFQUFFLFlBQVk7d0JBQ2xCLFNBQVMsRUFBRSxJQUFJO3dCQUNmLE1BQU0sRUFBRTs0QkFDTixJQUFJLEVBQUUsTUFBTTs0QkFDWixNQUFNLEVBQUUsT0FBTzs0QkFDZixTQUFTLEVBQUUsSUFBSTt5QkFDaEI7cUJBQ0Y7b0JBQ0QsMkJBQTJCLEVBQUUsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFO29CQUM3Qyx5QkFBeUIsRUFBRSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRTtpQkFDMUQ7YUFDRjtZQUNELFFBQVEsRUFBRTtnQkFDUixLQUFLLEVBQUUsRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFO2FBQ3JCO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFFdEQsU0FBUztRQUNULElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFFO1lBQ25DLEtBQUssRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLFNBQVU7WUFDbEMsVUFBVSxFQUFFLGlCQUFpQjtTQUM5QixDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUF4Q0QsZ0NBd0NDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcclxuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XHJcbmltcG9ydCAqIGFzIG9wZW5zZWFyY2hzZXJ2ZXJsZXNzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1vcGVuc2VhcmNoc2VydmVybGVzcyc7XHJcbmltcG9ydCB7IE9wZW5TZWFyY2hTdGFjayB9IGZyb20gJy4vb3BlbnNlYXJjaF9zdGFjayc7XHJcblxyXG5pbnRlcmZhY2UgSW5kZXhTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xyXG4gIG9wZW5TZWFyY2hTdGFjazogT3BlblNlYXJjaFN0YWNrO1xyXG59XHJcblxyXG5leHBvcnQgY2xhc3MgSW5kZXhTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XHJcbiAgcHVibGljIHJlYWRvbmx5IHZlY3RvckluZGV4OiBvcGVuc2VhcmNoc2VydmVybGVzcy5DZm5JbmRleDtcclxuXHJcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEluZGV4U3RhY2tQcm9wcykge1xyXG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XHJcblxyXG4gICAgY29uc3QgeyBjb2xsZWN0aW9uLCBkYXRhQWNjZXNzUG9saWN5IH0gPSBwcm9wcy5vcGVuU2VhcmNoU3RhY2s7XHJcblxyXG4gICAgLy8gVmVjdG9yIGluZGV4XHJcbiAgICB0aGlzLnZlY3RvckluZGV4ID0gbmV3IG9wZW5zZWFyY2hzZXJ2ZXJsZXNzLkNmbkluZGV4KHRoaXMsICdWZWN0b3JJbmRleCcsIHtcclxuICAgICAgY29sbGVjdGlvbkVuZHBvaW50OiBjb2xsZWN0aW9uLmF0dHJDb2xsZWN0aW9uRW5kcG9pbnQsXHJcbiAgICAgIGluZGV4TmFtZTogJ2JlZHJvY2sta25vd2xlZGdlLWJhc2UtaW5kZXgnLFxyXG4gICAgICBtYXBwaW5nczoge1xyXG4gICAgICAgIHByb3BlcnRpZXM6IHtcclxuICAgICAgICAgICdiZWRyb2NrLWtub3dsZWRnZS1iYXNlLXZlY3Rvcic6IHtcclxuICAgICAgICAgICAgdHlwZTogJ2tubl92ZWN0b3InLFxyXG4gICAgICAgICAgICBkaW1lbnNpb246IDEwMjQsXHJcbiAgICAgICAgICAgIG1ldGhvZDoge1xyXG4gICAgICAgICAgICAgIG5hbWU6ICdobnN3JyxcclxuICAgICAgICAgICAgICBlbmdpbmU6ICdmYWlzcycsXHJcbiAgICAgICAgICAgICAgc3BhY2VUeXBlOiAnbDInXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICAnQU1BWk9OX0JFRFJPQ0tfVEVYVF9DSFVOSyc6IHsgdHlwZTogJ3RleHQnIH0sXHJcbiAgICAgICAgICAnQU1BWk9OX0JFRFJPQ0tfTUVUQURBVEEnOiB7IHR5cGU6ICd0ZXh0JywgaW5kZXg6IGZhbHNlIH1cclxuICAgICAgICB9XHJcbiAgICAgIH0sXHJcbiAgICAgIHNldHRpbmdzOiB7XHJcbiAgICAgICAgaW5kZXg6IHsga25uOiB0cnVlIH1cclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy52ZWN0b3JJbmRleC5ub2RlLmFkZERlcGVuZGVuY3koZGF0YUFjY2Vzc1BvbGljeSk7XHJcblxyXG4gICAgLy8gT3V0cHV0XHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnSW5kZXhOYW1lJywge1xyXG4gICAgICB2YWx1ZTogdGhpcy52ZWN0b3JJbmRleC5pbmRleE5hbWUhLFxyXG4gICAgICBleHBvcnROYW1lOiAnVmVjdG9ySW5kZXhOYW1lJ1xyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcbiJdfQ==