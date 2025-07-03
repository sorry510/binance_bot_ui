// import { http } from "@/utils/http";

type Result = {
  success: boolean;
  data: Array<any>;
};

export const getAsyncRoutes = () => {
  return new Promise<Result>(resolve => {
    resolve({
      success: true,
      data: []
    });
  });
  // return http.request<Result>("get", "/get-async-routes");
};
