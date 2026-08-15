import KnowledgeArticlePage from '../../[workload]/[control]/page';

export default async function EntraKnowledgeArticle({
  params,
}: {
  params: Promise<{ control: string }>;
}) {
  const { control } = await params;
  return KnowledgeArticlePage({
    params: Promise.resolve({ workload: 'entra', control }),
  });
}
