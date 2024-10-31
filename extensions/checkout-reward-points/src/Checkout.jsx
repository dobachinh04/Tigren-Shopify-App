// File: tigren-app/extensions/checkout-reward-points/src/Checkout.jsx

import {
  reactExtension,
  BlockStack,
  Text,
  Button,
  TextField,
  useApi,
  useApplyAttributeChange,
  useTranslate,
} from "@shopify/ui-extensions-react/checkout";
import { useEffect, useState } from "react";

export default reactExtension(
  "purchase.checkout.cart-line-list.render-after",
  () => <Extension />,
);

function Extension() {
  const translate = useTranslate();
  const { extension } = useApi();
  const applyAttributeChange = useApplyAttributeChange();
  const [customerName, setCustomerName] = useState(null);
  const [customerAccessToken, setCustomerAccessToken] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentRewardPoints, setCurrentRewardPoints] = useState(0);
  const [pointsToUse, setPointsToUse] = useState(0);
  const [remainingRewardPoints, setRemainingRewardPoints] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  const storefrontAccessToken = "secret";
  SHOP_NAME = "secret";

  useEffect(() => {
    if (customerAccessToken) {
      fetchCustomerData(customerAccessToken);
    }
  }, [customerAccessToken]);

  useEffect(() => {
    setRemainingRewardPoints(currentRewardPoints - pointsToUse);
  }, [pointsToUse, currentRewardPoints]);

  async function loginCustomer(email, password) {
    const mutation = `
      mutation customerAccessTokenCreate($input: CustomerAccessTokenCreateInput!) {
        customerAccessTokenCreate(input: $input) {
          customerAccessToken {
            accessToken
            expiresAt
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = { input: { email, password } };

    try {
      const response = await fetch(
        `https://${SHOP_NAME}.myshopify.com/api/2024-07/graphql.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Storefront-Access-Token": storefrontAccessToken,
          },
          body: JSON.stringify({ query: mutation, variables }),
        },
      );

      const responseData = await response.json();
      const tokenData = responseData.data.customerAccessTokenCreate;

      if (tokenData.customerAccessToken) {
        setCustomerAccessToken(tokenData.customerAccessToken.accessToken);
        setIsLoggedIn(true);
      } else {
        console.error("Login failed:", tokenData.userErrors);
      }
    } catch (error) {
      console.error("Failed to login customer:", error);
    }
  }

  async function fetchCustomerData(token) {
    const query = `
      query ($customerAccessToken: String!) {
        customer(customerAccessToken: $customerAccessToken) {
          displayName
          metafield(namespace: "custom", key: "reward_points") {
            value
          }
        }
      }
    `;

    try {
      const response = await fetch(
        `https://${SHOP_NAME}.myshopify.com/api/2024-07/graphql.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Storefront-Access-Token": storefrontAccessToken,
          },
          body: JSON.stringify({
            query,
            variables: { customerAccessToken: token },
          }),
        },
      );

      const responseData = await response.json();
      const customerData = responseData.data.customer;

      if (customerData) {
        setCustomerName(customerData.displayName || "Khách");
        setCurrentRewardPoints(parseInt(customerData.metafield?.value) || 0);
      } else {
        setCustomerName("Khách");
        setCurrentRewardPoints(0);
      }
    } catch (error) {
      console.error("Không thể lấy dữ liệu khách hàng:", error);
      setCustomerName("Khách");
      setCurrentRewardPoints(0);
    }
  }

  async function applyRewardPoints(points) {
    try {
      const result = await applyAttributeChange({
        key: "rewardPointsUsed",
        type: "updateAttribute",
        value: points.toString(),
      });
      console.log("Điểm thưởng đã được áp dụng:", result);
    } catch (error) {
      console.error("Không thể áp dụng điểm thưởng:", error);
    }
  }

  return (
    <BlockStack spacing="loose" border="dotted" padding="tight">
      {!isLoggedIn ? (
        <>
          <Text size="medium" emphasis="strong">
            Đăng nhập để xem điểm thưởng
          </Text>
          <TextField label="Email" onChange={(value) => setEmail(value)} />
          <TextField
            label="Mật khẩu"
            type="password"
            onChange={(value) => setPassword(value)}
          />
          <Button onPress={() => loginCustomer(email, password)}>
            Đăng nhập
          </Button>
        </>
      ) : (
        <>
          <Text size="medium" emphasis="strong">
            Xin chào, {customerName}!
          </Text>
          <Text size="medium" emphasis="strong">
            Điểm thưởng còn lại: {remainingRewardPoints}
          </Text>

          <BlockStack spacing="extraTight">
            <TextField
              label="Sử dụng Điểm Thưởng"
              type="number"
              min="0"
              max={currentRewardPoints}
              onChange={(value) => {
                // Xóa thông báo lỗi trước đó
                setErrorMessage("");

                // Kiểm tra tính hợp lệ của input
                if (!/^\d*$/.test(value)) {
                  setErrorMessage("Điểm thưởng không hợp lệ");
                  return;
                }

                const points = parseInt(value) || 0;

                // Kiểm tra nếu điểm thưởng còn lại sẽ bị âm
                if (currentRewardPoints - points < 0) {
                  setErrorMessage("Số điểm thưởng còn lại không đủ");
                } else {
                  setPointsToUse(points);
                }
              }}
            />
            {errorMessage && (
              <Text size="small" style={{ color: "red" }}>
                {errorMessage}
              </Text>
            )}
            <Button
              onPress={() => {
                if (!errorMessage) applyRewardPoints(pointsToUse);
              }}
            >
              Áp dụng Điểm
            </Button>
          </BlockStack>
        </>
      )}
    </BlockStack>
  );
}
