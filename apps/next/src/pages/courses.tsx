import dynamic from "next/dynamic";
import React from "react";

import { HeadSeo } from "@pno/components/head-seo";

import { PageWrapper } from "../common/page-wrapper";
import { Loading } from "../components/loading";
import { WithFooter } from "../components/with-footer";
import { getLayout } from "../layouts/main-layout";

const CoursesApp = dynamic(() => import("../modules/courses/CoursesApp"), {
  ssr: false,
  loading: () => <Loading />,
});

const CoursesPage = () => {
  return (
    <>
      <HeadSeo title="Data Courses — XómData Interactive" />
      <WithFooter>
        <CoursesApp />
      </WithFooter>
    </>
  );
};

CoursesPage.getLayout = getLayout;
CoursesPage.PageWrapper = PageWrapper;

export default CoursesPage;
