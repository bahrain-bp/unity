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
        const prefixname = this.stackName.split('-')[0].toLowerCase();
        // Vector index
        this.vectorIndex = new opensearchserverless.CfnIndex(this, 'VectorIndex', {
            collectionEndpoint: collection.attrCollectionEndpoint,
            indexName: `${prefixname}-vector-index`,
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
            exportName: `${prefixname}-IndexName`
        });
    }
}
exports.IndexStack = IndexStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXhfc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleF9zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUVuQywyRkFBNkU7QUFPN0UsTUFBYSxVQUFXLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDdkIsV0FBVyxDQUFnQztJQUUzRCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXNCO1FBQzlELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sRUFBRSxVQUFVLEVBQUUsZ0JBQWdCLEVBQUUsR0FBRyxLQUFLLENBQUMsZUFBZSxDQUFDO1FBQy9ELE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBRTlELGVBQWU7UUFDZixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksb0JBQW9CLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxhQUFhLEVBQUU7WUFDeEUsa0JBQWtCLEVBQUUsVUFBVSxDQUFDLHNCQUFzQjtZQUNyRCxTQUFTLEVBQUUsR0FBRyxVQUFVLGVBQWU7WUFDdkMsUUFBUSxFQUFFO2dCQUNSLFVBQVUsRUFBRTtvQkFDViwrQkFBK0IsRUFBRTt3QkFDL0IsSUFBSSxFQUFFLFlBQVk7d0JBQ2xCLFNBQVMsRUFBRSxJQUFJO3dCQUNmLE1BQU0sRUFBRTs0QkFDTixJQUFJLEVBQUUsTUFBTTs0QkFDWixNQUFNLEVBQUUsT0FBTzs0QkFDZixTQUFTLEVBQUUsSUFBSTt5QkFDaEI7cUJBQ0Y7b0JBQ0QsMkJBQTJCLEVBQUUsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFO29CQUM3Qyx5QkFBeUIsRUFBRSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRTtpQkFDMUQ7YUFDRjtZQUNELFFBQVEsRUFBRTtnQkFDUixLQUFLLEVBQUUsRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFO2FBQ3JCO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFFdEQsU0FBUztRQUNULElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFFO1lBQ25DLEtBQUssRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLFNBQVU7WUFDbEMsVUFBVSxFQUFFLEdBQUcsVUFBVSxZQUFZO1NBQ3RDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQXpDRCxnQ0F5Q0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xyXG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcclxuaW1wb3J0ICogYXMgb3BlbnNlYXJjaHNlcnZlcmxlc3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLW9wZW5zZWFyY2hzZXJ2ZXJsZXNzJztcclxuaW1wb3J0IHsgT3BlblNlYXJjaFN0YWNrIH0gZnJvbSAnLi9vcGVuc2VhcmNoX3N0YWNrJztcclxuXHJcbmludGVyZmFjZSBJbmRleFN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XHJcbiAgb3BlblNlYXJjaFN0YWNrOiBPcGVuU2VhcmNoU3RhY2s7XHJcbn1cclxuXHJcbmV4cG9ydCBjbGFzcyBJbmRleFN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcclxuICBwdWJsaWMgcmVhZG9ubHkgdmVjdG9ySW5kZXg6IG9wZW5zZWFyY2hzZXJ2ZXJsZXNzLkNmbkluZGV4O1xyXG5cclxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogSW5kZXhTdGFja1Byb3BzKSB7XHJcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcclxuXHJcbiAgICBjb25zdCB7IGNvbGxlY3Rpb24sIGRhdGFBY2Nlc3NQb2xpY3kgfSA9IHByb3BzLm9wZW5TZWFyY2hTdGFjaztcclxuICAgIGNvbnN0IHByZWZpeG5hbWUgPSB0aGlzLnN0YWNrTmFtZS5zcGxpdCgnLScpWzBdLnRvTG93ZXJDYXNlKCk7XHJcblxyXG4gICAgLy8gVmVjdG9yIGluZGV4XHJcbiAgICB0aGlzLnZlY3RvckluZGV4ID0gbmV3IG9wZW5zZWFyY2hzZXJ2ZXJsZXNzLkNmbkluZGV4KHRoaXMsICdWZWN0b3JJbmRleCcsIHtcclxuICAgICAgY29sbGVjdGlvbkVuZHBvaW50OiBjb2xsZWN0aW9uLmF0dHJDb2xsZWN0aW9uRW5kcG9pbnQsXHJcbiAgICAgIGluZGV4TmFtZTogYCR7cHJlZml4bmFtZX0tdmVjdG9yLWluZGV4YCxcclxuICAgICAgbWFwcGluZ3M6IHtcclxuICAgICAgICBwcm9wZXJ0aWVzOiB7XHJcbiAgICAgICAgICAnYmVkcm9jay1rbm93bGVkZ2UtYmFzZS12ZWN0b3InOiB7XHJcbiAgICAgICAgICAgIHR5cGU6ICdrbm5fdmVjdG9yJyxcclxuICAgICAgICAgICAgZGltZW5zaW9uOiAxMDI0LFxyXG4gICAgICAgICAgICBtZXRob2Q6IHtcclxuICAgICAgICAgICAgICBuYW1lOiAnaG5zdycsXHJcbiAgICAgICAgICAgICAgZW5naW5lOiAnZmFpc3MnLFxyXG4gICAgICAgICAgICAgIHNwYWNlVHlwZTogJ2wyJ1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgJ0FNQVpPTl9CRURST0NLX1RFWFRfQ0hVTksnOiB7IHR5cGU6ICd0ZXh0JyB9LFxyXG4gICAgICAgICAgJ0FNQVpPTl9CRURST0NLX01FVEFEQVRBJzogeyB0eXBlOiAndGV4dCcsIGluZGV4OiBmYWxzZSB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG4gICAgICBzZXR0aW5nczoge1xyXG4gICAgICAgIGluZGV4OiB7IGtubjogdHJ1ZSB9XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMudmVjdG9ySW5kZXgubm9kZS5hZGREZXBlbmRlbmN5KGRhdGFBY2Nlc3NQb2xpY3kpO1xyXG5cclxuICAgIC8vIE91dHB1dFxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0luZGV4TmFtZScsIHtcclxuICAgICAgdmFsdWU6IHRoaXMudmVjdG9ySW5kZXguaW5kZXhOYW1lISxcclxuICAgICAgZXhwb3J0TmFtZTogYCR7cHJlZml4bmFtZX0tSW5kZXhOYW1lYFxyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcbiJdfQ==