import React from "react";

import { Modal } from "@pno/components";

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
              message="Classes are currently disabled"
              subheading="You have full direct access to all Quiz study sets, folders, Anki/Quizlet imports, and 4-skill IELTS practice on PNO."
            />
            <Button colorScheme="blue" onClick={() => setOpen(false)}>
              Close
            </Button>
          </VStack>
        </Modal.Body>
      </Modal.Content>
    </Modal>
  );
};

export default CreateClassNotice;
