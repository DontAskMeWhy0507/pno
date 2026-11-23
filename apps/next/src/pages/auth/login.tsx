import type { GetServerSideProps } from "next";

export default function Login() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: "/home",
    permanent: false,
  },
});
