import KnowledgeWorkloadPage from '../[workload]/page';

export default async function EntraKnowledgePage() {
  return KnowledgeWorkloadPage({
    params: Promise.resolve({ workload: 'entra' }),
  });
}
