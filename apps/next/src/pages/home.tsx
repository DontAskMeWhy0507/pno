import { useSession } from "next-auth/react";
import React from "react";

import { HeadSeo } from "@pno/components/head-seo";
import { api } from "@pno/trpc";

import { Container, Stack } from "@chakra-ui/react";

import { PageWrapper } from "../common/page-wrapper";
import { AuthedPage } from "../components/authed-page";
import { WithFooter } from "../components/with-footer";
import { getLayout } from "../layouts/main-layout";
import { writeRecentCache } from "../lib/local-query-cache";
import { ClassesGrid } from "../modules/home/classes-grid";
import { EmptyDashboard } from "../modules/home/empty-dashboard";
import { SetGrid } from "../modules/home/set-grid";

const Home = () => {
  const { data: session, status } = useSession();
  const { data, isLoading: recentLoading } = api.recent.get.useQuery();
  const isEmpty = !data?.entities.length;

  React.useEffect(() => {
    if (session?.user?.id && data) {
      writeRecentCache(session.user.id, data);
    }
  }, [session?.user?.id, data]);

  const isLoading = status == "unauthenticated" || recentLoading;

  return (
    <AuthedPage>
      <HeadSeo title="Quiz" />
      <WithFooter>
        <Container maxW="7xl">
          <Stack spacing={12}>
            {!isLoading && isEmpty && <EmptyDashboard />}
            <SetGrid />
            <ClassesGrid />
          </Stack>
        </Container>
      </WithFooter>
    </AuthedPage>
  );
};

Home.getLayout = getLayout;
Home.PageWrapper = PageWrapper;

export default Home;
