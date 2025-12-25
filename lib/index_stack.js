"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IndexStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const opensearchserverless = __importStar(require("aws-cdk-lib/aws-opensearchserverless"));
class IndexStack extends cdk.Stack {
    vectorIndex;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXhfc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleF9zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUVuQywyRkFBNkU7QUFPN0UsTUFBYSxVQUFXLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDdkIsV0FBVyxDQUFnQztJQUUzRCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXNCO1FBQzlELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sRUFBRSxVQUFVLEVBQUUsZ0JBQWdCLEVBQUUsR0FBRyxLQUFLLENBQUMsZUFBZSxDQUFDO1FBRS9ELGVBQWU7UUFDZixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksb0JBQW9CLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxhQUFhLEVBQUU7WUFDeEUsa0JBQWtCLEVBQUUsVUFBVSxDQUFDLHNCQUFzQjtZQUNyRCxTQUFTLEVBQUUsb0JBQW9CO1lBQy9CLFFBQVEsRUFBRTtnQkFDUixVQUFVLEVBQUU7b0JBQ1YsK0JBQStCLEVBQUU7d0JBQy9CLElBQUksRUFBRSxZQUFZO3dCQUNsQixTQUFTLEVBQUUsSUFBSTt3QkFDZixNQUFNLEVBQUU7NEJBQ04sSUFBSSxFQUFFLE1BQU07NEJBQ1osTUFBTSxFQUFFLE9BQU87NEJBQ2YsU0FBUyxFQUFFLElBQUk7eUJBQ2hCO3FCQUNGO29CQUNELDJCQUEyQixFQUFFLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRTtvQkFDN0MseUJBQXlCLEVBQUUsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUU7aUJBQzFEO2FBQ0Y7WUFDRCxRQUFRLEVBQUU7Z0JBQ1IsS0FBSyxFQUFFLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRTthQUNyQjtTQUNGLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBRXRELFNBQVM7UUFDVCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRTtZQUNuQyxLQUFLLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxTQUFVO1lBQ2xDLFVBQVUsRUFBRSxnQkFBZ0I7U0FDN0IsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBeENELGdDQXdDQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XHJcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xyXG5pbXBvcnQgKiBhcyBvcGVuc2VhcmNoc2VydmVybGVzcyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtb3BlbnNlYXJjaHNlcnZlcmxlc3MnO1xyXG5pbXBvcnQgeyBPcGVuU2VhcmNoU3RhY2sgfSBmcm9tICcuL29wZW5zZWFyY2hfc3RhY2snO1xyXG5cclxuaW50ZXJmYWNlIEluZGV4U3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcclxuICBvcGVuU2VhcmNoU3RhY2s6IE9wZW5TZWFyY2hTdGFjaztcclxufVxyXG5cclxuZXhwb3J0IGNsYXNzIEluZGV4U3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xyXG4gIHB1YmxpYyByZWFkb25seSB2ZWN0b3JJbmRleDogb3BlbnNlYXJjaHNlcnZlcmxlc3MuQ2ZuSW5kZXg7XHJcblxyXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBJbmRleFN0YWNrUHJvcHMpIHtcclxuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xyXG5cclxuICAgIGNvbnN0IHsgY29sbGVjdGlvbiwgZGF0YUFjY2Vzc1BvbGljeSB9ID0gcHJvcHMub3BlblNlYXJjaFN0YWNrO1xyXG5cclxuICAgIC8vIFZlY3RvciBpbmRleFxyXG4gICAgdGhpcy52ZWN0b3JJbmRleCA9IG5ldyBvcGVuc2VhcmNoc2VydmVybGVzcy5DZm5JbmRleCh0aGlzLCAnVmVjdG9ySW5kZXgnLCB7XHJcbiAgICAgIGNvbGxlY3Rpb25FbmRwb2ludDogY29sbGVjdGlvbi5hdHRyQ29sbGVjdGlvbkVuZHBvaW50LFxyXG4gICAgICBpbmRleE5hbWU6ICd1bml0eS12ZWN0b3ItaW5kZXgnLFxyXG4gICAgICBtYXBwaW5nczoge1xyXG4gICAgICAgIHByb3BlcnRpZXM6IHtcclxuICAgICAgICAgICdiZWRyb2NrLWtub3dsZWRnZS1iYXNlLXZlY3Rvcic6IHtcclxuICAgICAgICAgICAgdHlwZTogJ2tubl92ZWN0b3InLFxyXG4gICAgICAgICAgICBkaW1lbnNpb246IDEwMjQsXHJcbiAgICAgICAgICAgIG1ldGhvZDoge1xyXG4gICAgICAgICAgICAgIG5hbWU6ICdobnN3JyxcclxuICAgICAgICAgICAgICBlbmdpbmU6ICdmYWlzcycsXHJcbiAgICAgICAgICAgICAgc3BhY2VUeXBlOiAnbDInXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICAnQU1BWk9OX0JFRFJPQ0tfVEVYVF9DSFVOSyc6IHsgdHlwZTogJ3RleHQnIH0sXHJcbiAgICAgICAgICAnQU1BWk9OX0JFRFJPQ0tfTUVUQURBVEEnOiB7IHR5cGU6ICd0ZXh0JywgaW5kZXg6IGZhbHNlIH1cclxuICAgICAgICB9XHJcbiAgICAgIH0sXHJcbiAgICAgIHNldHRpbmdzOiB7XHJcbiAgICAgICAgaW5kZXg6IHsga25uOiB0cnVlIH1cclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy52ZWN0b3JJbmRleC5ub2RlLmFkZERlcGVuZGVuY3koZGF0YUFjY2Vzc1BvbGljeSk7XHJcblxyXG4gICAgLy8gT3V0cHV0XHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnSW5kZXhOYW1lJywge1xyXG4gICAgICB2YWx1ZTogdGhpcy52ZWN0b3JJbmRleC5pbmRleE5hbWUhLFxyXG4gICAgICBleHBvcnROYW1lOiAnVW5pdHlJbmRleE5hbWUnXHJcbiAgICB9KTtcclxuICB9XHJcbn1cclxuIl19