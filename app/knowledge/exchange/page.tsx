import KnowledgeWorkloadPage from '../[workload]/page';

export default async function ExchangeKnowledgePage() {
  return KnowledgeWorkloadPage({
    params: Promise.resolve({ workload: 'exchange' }),
  });
}
