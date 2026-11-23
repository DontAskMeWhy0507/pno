import React from "react";

import { Modal } from "@quenti/components";

import { Button, VStack } from "@chakra-ui/react";

import { menuEventChannel } from "../events/menu";
import { GhostMessage } from "./ghost-message";

export const CreateClassNotice = () => {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const open = () => setOpen(true);

    menuEventChannel.on("openCreateClassNotice", open);
    return () => {
      menuEventChannel.off("openCreateClassNotice", open);
    };
  }, []);

  return (
    <Modal isOpen={open} onClose={() => setOpen(false)} size="xl">
      <Modal.Overlay />
      <Modal.Content>
        <Modal.Body>
          <Modal.CloseButton />
          <VStack spacing="6">
            <GhostMessage
              message="Tính năng lớp học đang tạm ẩn"
              subheading="Hiện tại bạn có thể dùng trực tiếp toàn bộ tính năng Quiz (tạo bộ thẻ, thư mục, nhập Anki/Quizlet) và Thi IELTS trên PNO."
            />
            <Button colorScheme="blue" onClick={() => setOpen(false)}>
              Đóng
            </Button>
          </VStack>
        </Modal.Body>
      </Modal.Content>
    </Modal>
  );
};

export default CreateClassNotice;
