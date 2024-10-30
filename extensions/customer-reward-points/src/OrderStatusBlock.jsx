import {
  BlockStack,
  reactExtension,
  TextBlock,
  Banner,
  useApi
} from "@shopify/ui-extensions-react/customer-account";

export default reactExtension(
  "customer-account.profile.block.render", // Đổi target sang profile
  () => <PromotionBanner />
);

function PromotionBanner() {
  const { i18n } = useApi();

  return (
    <Banner>
      <BlockStack inlineAlignment="center">
        <TextBlock>
          {i18n.translate("earnPoints")}
        </TextBlock>
        <TextBlock>
          Hello World
        </TextBlock>
      </BlockStack>
    </Banner>
  );
}
