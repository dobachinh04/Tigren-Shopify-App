// app/routes/app.products.jsx
import React, { useState, useCallback } from "react";
import {
  Page,
  IndexTable,
  Card,
  TextField,
  Filters,
  Button,
  Pagination,
  Frame,
  Toast,
  useIndexResourceState,
  Badge,
  Thumbnail,
  LegacyCard,
  Modal,
} from "@shopify/polaris";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { apiVersion, authenticate } from "../shopify.server";
import "../styles/reward-points.css";

// GraphQL query để lấy danh sách sản phẩm
const query = `
  {
    products(first: 10) {
      edges {
        node {
          id
          title
          featuredImage {
            originalSrc
          }
          status
          totalInventory
          productType
          vendor
          collections(first: 1) {
            edges {
              node {
                title
              }
            }
          }
        }
      }
    }
  }
`;

// GraphQL mutation để xóa sản phẩm
const DELETE_PRODUCT_MUTATION = `
  mutation deleteProduct($id: ID!) {
    productDelete(input: { id: $id }) {
      deletedProductId
      userErrors {
        field
        message
      }
    }
  }
`;

// Loader để lấy dữ liệu từ Shopify
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const { shop, accessToken } = session;

  try {
    const response = await fetch(
      `https://${shop}/admin/api/${apiVersion}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({ query }),
      }
    );

    const result = await response.json();
    if (result.errors) {
      console.error("GraphQL Error:", result.errors);
      throw new Error(result.errors[0]?.message || "GraphQL query failed");
    }

    if (!result?.data?.products) {
      throw new Error("No products data found in response.");
    }

    return result.data.products.edges.map(({ node }) => ({
      id: node.id,
      name: node.title ?? "N/A",
      image: node.featuredImage?.originalSrc ?? "",
      status: node.status ?? "N/A",
      inventory: node.totalInventory ?? 0,
      type: node.productType ?? "N/A",
      vendor: node.vendor ?? "N/A",
      category: node.collections.edges[0]?.node?.title ?? "Uncategorized",
    }));
  } catch (error) {
    console.error("Error fetching products:", error);
    throw new Response("Failed to load products", { status: 500 });
  }
};

// Action để xử lý mutation xóa sản phẩm
export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const { shop, accessToken } = session;

  const formData = await request.formData();
  const productId = formData.get("id");

  const response = await fetch(
    `https://${shop}/admin/api/${apiVersion}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({
        query: DELETE_PRODUCT_MUTATION,
        variables: { id: productId },
      }),
    }
  );

  const result = await response.json();
  if (result.errors || result.data.productDelete.userErrors.length > 0) {
    console.error("Error deleting product:", result.errors);
    return { success: false, error: "Failed to delete product" };
  }

  return { success: true };
};

function ProductsPage() {
  const productsData = useLoaderData();
  const fetcher = useFetcher();
  const [products, setProducts] = useState(productsData);
  const [showToast, setShowToast] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [searchValue, setSearchValue] = useState("");
  const [filteredProducts, setFilteredProducts] = useState(productsData);

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(filteredProducts);

  // Hiển thị modal xác nhận xóa
  const handleDeleteClick = (id) => {
    setProductToDelete(id);
    setShowModal(true);
  };

  // Xác nhận xóa sản phẩm
  const confirmDelete = useCallback(() => {
    if (!productToDelete) return;
    fetcher.submit(
      { id: productToDelete },
      { method: "post", action: "/app/products?action=delete" }
    );

    // Cập nhật state sau khi xóa
    setProducts((prev) => prev.filter((product) => product.id !== productToDelete));
    setFilteredProducts((prev) => prev.filter((product) => product.id !== productToDelete));
    setShowToast(true);
    setShowModal(false);
    setProductToDelete(null);
  }, [fetcher, productToDelete]);

  const handleSearch = useCallback(
    (value) => {
      setSearchValue(value);
      const searchResult = products.filter((product) =>
        product.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredProducts(searchResult);
    },
    [products]
  );

  const rowMarkup = filteredProducts.map(
    ({ id, name, image, status, inventory, type, vendor, category }, index) => (
      <IndexTable.Row
        id={id}
        key={id}
        selected={selectedResources.includes(id)}
      >
        <IndexTable.Cell>{index + 1}</IndexTable.Cell>
        <IndexTable.Cell>
          <Thumbnail source={image} alt={name} size="small" />
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge>{name}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>{status}</IndexTable.Cell>
        <IndexTable.Cell>{inventory}</IndexTable.Cell>
        <IndexTable.Cell>{category}</IndexTable.Cell>
        <IndexTable.Cell>{type}</IndexTable.Cell>
        <IndexTable.Cell>{vendor}</IndexTable.Cell>
        <IndexTable.Cell>
          <Button onClick={() => console.log("Edit", id)}>Edit</Button>
          <Button onClick={() => handleDeleteClick(id)} destructive>
            Delete
          </Button>
        </IndexTable.Cell>
      </IndexTable.Row>
    )
  );

  return (
    <Frame>
      <Page fullWidth title="Products">
        <Card sectioned>
          <Filters
            queryValue={searchValue}
            onQueryChange={handleSearch}
            onQueryClear={() => handleSearch("")}
            filters={[]}
          >
            <div style={{ paddingLeft: "8px" }}>
              <Button primary>Add Product</Button>
            </div>
          </Filters>
        </Card>

        <LegacyCard>
          <IndexTable
            resourceName={{ singular: "product", plural: "products" }}
            itemCount={filteredProducts.length}
            selectedItemsCount={
              allResourcesSelected ? "All" : selectedResources.length
            }
            onSelectionChange={handleSelectionChange}
            headings={[
              { title: "ID" },
              { title: "Image" },
              { title: "Name" },
              { title: "Status" },
              { title: "Inventory" },
              { title: "Category" },
              { title: "Type" },
              { title: "Vendor" },
              { title: "Actions" },
            ]}
          >
            {rowMarkup}
          </IndexTable>
        </LegacyCard>

        <Pagination
          hasPrevious
          hasNext
          onPrevious={() => console.log("Previous page")}
          onNext={() => console.log("Next page")}
        />

        {showToast && (
          <Toast
            content="Product deleted successfully"
            onDismiss={() => setShowToast(false)}
          />
        )}

        {showModal && (
          <Modal
            open={showModal}
            onClose={() => setShowModal(false)}
            title="Delete Product"
            primaryAction={{
              content: "Confirm",
              destructive: true,
              onAction: confirmDelete,
            }}
            secondaryActions={[
              {
                content: "Cancel",
                onAction: () => setShowModal(false),
              },
            ]}
          >
            <Modal.Section>
              <p>Are you sure you want to delete this product? This action cannot be undone.</p>
            </Modal.Section>
          </Modal>
        )}
      </Page>
    </Frame>
  );
}

export default ProductsPage;
